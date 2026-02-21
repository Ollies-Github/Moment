import { randomUUID } from "node:crypto";

import type { MockBetBuilderService } from "@moment/ai-bet-builder";
import type { MockBetCloserService } from "@moment/ai-bet-closer";
import type { MockBetStarterService, TriggerStarterOptions } from "@moment/ai-bet-starter";
import type { TypedEventBus } from "@moment/event-bus";
import type { OracleAdapter } from "@moment/oracle-adapter";
import { createAmmState, executeTrade, getImpliedProbabilities, getQuote } from "@moment/pricing-engine";
import {
  betQuoteRequestSchema,
  betRequestSchema,
  type Bet,
  type BetQuoteRequest,
  type BetQuoteResponse,
  type BetRequest,
  type BetStarterEvent,
  type EngineEventMap,
  type Market,
  type MarketRejectedPayload,
  type Selection,
  type StreamStatus,
  type Wallet,
} from "@moment/shared";

export interface MarketEngineOptions {
  maxOpenDurationMs?: number;
  safetySweepIntervalMs?: number;
  defaultWalletBalance?: number;
}

export class MarketLifecycleError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface MarketEngineDeps {
  bus: TypedEventBus<EngineEventMap>;
  starter: MockBetStarterService;
  builder: MockBetBuilderService;
  closer: MockBetCloserService;
  oracle: OracleAdapter;
  options?: MarketEngineOptions;
}

const canonicalize = (selection: Selection): "YES" | "NO" => {
  if (selection === "YES" || selection === "HIGHER") {
    return "YES";
  }
  return "NO";
};

const validSelection = (market: Market, selection: Selection): boolean => {
  if (market.market_type === "binary_yes_no") {
    return selection === "YES" || selection === "NO";
  }
  return selection === "HIGHER" || selection === "LOWER";
};

export class MarketEngine {
  private readonly bus: TypedEventBus<EngineEventMap>;
  private readonly starter: MockBetStarterService;
  private readonly builder: MockBetBuilderService;
  private readonly closer: MockBetCloserService;
  private readonly oracle: OracleAdapter;
  private readonly maxOpenDurationMs: number;
  private readonly safetySweepIntervalMs: number;
  private readonly defaultWalletBalance: number;

  private readonly markets = new Map<string, Market>();
  private readonly bets = new Map<string, Bet>();
  private readonly betsByUser = new Map<string, string[]>();
  private readonly wallets = new Map<string, Wallet>();
  private readonly processedStarterEvents = new Set<string>();

  private unsubs: Array<() => void> = [];
  private safetyHandle?: NodeJS.Timeout;

  private streamStatus: StreamStatus = {
    active_connections: 0,
    emitted_events: 0,
    updated_at_ms: Date.now(),
  };

  constructor({ bus, starter, builder, closer, oracle, options = {} }: MarketEngineDeps) {
    this.bus = bus;
    this.starter = starter;
    this.builder = builder;
    this.closer = closer;
    this.oracle = oracle;
    this.maxOpenDurationMs = options.maxOpenDurationMs ?? 60_000;
    this.safetySweepIntervalMs = options.safetySweepIntervalMs ?? 2_500;
    this.defaultWalletBalance = options.defaultWalletBalance ?? 100;

    this.wireEvents();
  }

  private wireEvents(): void {
    this.unsubs = [
      this.bus.on("starter.detected", (event) => this.onStarterDetected(event)),
      this.bus.on("closer.triggered", (trigger) => this.onCloseTriggered(trigger.market_id, trigger.reason)),
    ];
  }

  start(): void {
    if (this.unsubs.length === 0) {
      this.wireEvents();
    }

    if (!this.safetyHandle) {
      this.safetyHandle = setInterval(() => {
        this.suspendStaleMarkets();
      }, this.safetySweepIntervalMs);
    }
    this.starter.start();
  }

  stop(): void {
    this.starter.stop();
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    if (this.safetyHandle) {
      clearInterval(this.safetyHandle);
      this.safetyHandle = undefined;
    }
  }

  setConnectionCount(count: number): void {
    this.streamStatus.active_connections = count;
    this.streamStatus.updated_at_ms = Date.now();
  }

  getStreamStatus(): StreamStatus {
    return {
      ...this.streamStatus,
      updated_at_ms: Date.now(),
    };
  }

  simulateStarterEvent(options: TriggerStarterOptions = {}): BetStarterEvent {
    return this.starter.trigger(options);
  }

  simulateCloseMarket(marketId: string, reason = "manual_dev_trigger"): void {
    this.closer.triggerClose(marketId, { reason });
  }

  async simulateSettleMarket(marketId: string, outcome: Selection): Promise<Market> {
    return this.settleMarket(marketId, outcome);
  }

  reset(): void {
    this.markets.clear();
    this.bets.clear();
    this.betsByUser.clear();
    this.wallets.clear();
    this.processedStarterEvents.clear();
  }

  getLiveMarkets(): Market[] {
    return [...this.markets.values()].sort(
      (a, b) => b.timestamps.updated_at_ms - a.timestamps.updated_at_ms,
    );
  }

  getMarket(marketId: string): Market | undefined {
    return this.markets.get(marketId);
  }

  getBetsForUser(userId: string): Bet[] {
    const ids = this.betsByUser.get(userId) ?? [];
    return ids.map((id) => this.bets.get(id)).filter((bet): bet is Bet => Boolean(bet));
  }

  getWallet(userId: string): Wallet {
    return this.ensureWallet(userId);
  }

  quoteBet(input: BetQuoteRequest): BetQuoteResponse {
    const request = betQuoteRequestSchema.parse(input);
    const market = this.markets.get(request.market_id);
    if (!market) {
      throw new MarketLifecycleError("MARKET_NOT_FOUND", `Market ${request.market_id} not found`);
    }
    if (market.status !== "open") {
      throw new MarketLifecycleError("MARKET_NOT_OPEN", `Market ${market.market_id} is ${market.status}`);
    }
    if (!validSelection(market, request.selection)) {
      throw new MarketLifecycleError("INVALID_SELECTION", "Selection does not match market type");
    }

    const { quote } = getQuote(market.amm_state, request.selection, request.stake);

    return {
      ...quote,
      market_id: request.market_id,
    };
  }

  placeBet(input: BetRequest): Bet {
    const request = betRequestSchema.parse(input);
    const market = this.markets.get(request.market_id);
    if (!market) {
      return this.rejectBet(request, "Market not found");
    }

    if (market.status !== "open") {
      return this.rejectBet(request, `Market is ${market.status}`);
    }

    if (!validSelection(market, request.selection)) {
      return this.rejectBet(request, "Selection does not match market type");
    }

    const wallet = this.ensureWallet(request.user_id);
    if (wallet.balance < request.stake) {
      return this.rejectBet(request, "Insufficient wallet balance");
    }

    const { quote, nextState } = executeTrade(market.amm_state, request.selection, request.stake);

    const now = Date.now();
    const bet: Bet = {
      bet_id: randomUUID(),
      user_id: request.user_id,
      market_id: request.market_id,
      selection: request.selection,
      stake: request.stake,
      fee: quote.fee,
      effective_stake: quote.effective_stake,
      accepted_price: quote.estimated_price,
      potential_payout: quote.potential_payout,
      status: "accepted",
      created_at_ms: now,
    };

    market.amm_state = nextState;
    market.prices = getImpliedProbabilities(nextState);
    market.timestamps.updated_at_ms = now;

    wallet.balance -= request.stake;
    wallet.updated_at_ms = now;

    this.bets.set(bet.bet_id, bet);
    this.betsByUser.set(request.user_id, [...(this.betsByUser.get(request.user_id) ?? []), bet.bet_id]);

    this.markets.set(market.market_id, market);
    this.wallets.set(wallet.user_id, wallet);

    this.emit("market.updated", market);
    this.emit("bet.accepted", bet);
    this.emit("wallet.updated", wallet);

    return bet;
  }

  private rejectBet(request: BetRequest, reason: string): Bet {
    const now = Date.now();
    const rejected: Bet = {
      bet_id: randomUUID(),
      user_id: request.user_id,
      market_id: request.market_id,
      selection: request.selection,
      stake: request.stake,
      fee: 0,
      effective_stake: 0,
      accepted_price: 0.5,
      potential_payout: 0,
      status: "rejected",
      created_at_ms: now,
      rejection_reason: reason,
    };

    const payload: MarketRejectedPayload = {
      market_id: request.market_id,
      user_id: request.user_id,
      reason,
      rejected_at_ms: now,
    };

    this.emit("bet.rejected", payload);
    return rejected;
  }

  private onStarterDetected(starterEvent: BetStarterEvent): void {
    if (this.processedStarterEvents.has(starterEvent.starter_event_id)) {
      return;
    }

    this.processedStarterEvents.add(starterEvent.starter_event_id);
    const payload = this.builder.buildMarketPayload(starterEvent);

    if (this.markets.has(payload.market_id)) {
      return;
    }

    const ammState = createAmmState(
      payload.market_making.initial_probability_yes,
      payload.market_making.virtual_liquidity,
      payload.market_making.fee_bps,
    );

    const now = Date.now();
    const market: Market = {
      ...payload,
      status: "open",
      amm_state: ammState,
      prices: getImpliedProbabilities(ammState),
      timestamps: {
        open_at_ms: payload.open_at_ms,
        updated_at_ms: now,
      },
      safety: {
        max_open_duration_ms: this.maxOpenDurationMs,
        expires_at_ms: payload.open_at_ms + this.maxOpenDurationMs,
        timeout_triggered: false,
      },
    };

    this.markets.set(market.market_id, market);
    this.emit("market.opened", market);
  }

  private onCloseTriggered(marketId: string, reason: string): void {
    const market = this.markets.get(marketId);
    if (!market) {
      return;
    }

    if (market.status !== "open" && market.status !== "closing") {
      return;
    }

    const now = Date.now();
    market.status = "closed";
    market.timestamps.updated_at_ms = now;
    market.timestamps.closed_at_ms = now;
    market.context = {
      ...market.context,
      close_reason: reason,
    };

    this.markets.set(market.market_id, market);
    this.emit("market.closed", market);
  }

  // Safety timeout path: stale markets are suspended server-side even without a close signal.
  private suspendStaleMarkets(): void {
    const now = Date.now();

    for (const market of this.markets.values()) {
      if (market.status !== "open") {
        continue;
      }

      if (now <= market.safety.expires_at_ms) {
        continue;
      }

      market.status = "suspended";
      market.timestamps.updated_at_ms = now;
      market.timestamps.suspended_at_ms = now;
      market.safety.timeout_triggered = true;
      market.context = {
        ...market.context,
        suspension_reason: "safety_timeout",
      };

      this.markets.set(market.market_id, market);
      this.emit("market.suspended", market);
    }
  }

  private ensureWallet(userId: string): Wallet {
    const existing = this.wallets.get(userId);
    if (existing) {
      return existing;
    }

    const wallet: Wallet = {
      user_id: userId,
      balance: this.defaultWalletBalance,
      updated_at_ms: Date.now(),
    };

    this.wallets.set(userId, wallet);
    return wallet;
  }

  async settleMarket(marketId: string, proposedOutcome: Selection): Promise<Market> {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new MarketLifecycleError("MARKET_NOT_FOUND", `Market ${marketId} not found`);
    }

    if (market.status === "settled") {
      return market;
    }

    if (market.status === "open") {
      this.onCloseTriggered(marketId, "settlement_requested");
    }

    if (market.status !== "closed" && market.status !== "suspended") {
      throw new MarketLifecycleError("INVALID_MARKET_STATE", `Cannot settle market in state ${market.status}`);
    }

    const oracleResult = await this.oracle.confirmOutcome(marketId, proposedOutcome);

    if (!oracleResult.confirmed || !oracleResult.outcome) {
      market.status = "suspended";
      market.timestamps.updated_at_ms = Date.now();
      market.context = {
        ...market.context,
        oracle_rejection: true,
      };
      this.markets.set(market.market_id, market);
      this.emit("market.suspended", market);
      throw new MarketLifecycleError("ORACLE_NOT_CONFIRMED", "Oracle could not confirm settlement");
    }

    const now = Date.now();
    const marketOutcome = oracleResult.outcome;

    for (const bet of this.bets.values()) {
      if (bet.market_id !== market.market_id || bet.status !== "accepted") {
        continue;
      }

      const isWin = canonicalize(bet.selection) === canonicalize(marketOutcome);
      bet.status = isWin ? "settled_won" : "settled_lost";
      bet.payout = isWin ? bet.potential_payout : 0;
      bet.settled_at_ms = now;
      this.bets.set(bet.bet_id, bet);

      const wallet = this.ensureWallet(bet.user_id);
      if (isWin) {
        wallet.balance += bet.payout;
      }
      wallet.updated_at_ms = now;
      this.wallets.set(wallet.user_id, wallet);
      this.emit("wallet.updated", wallet);
    }

    market.status = "settled";
    market.settlement_outcome = marketOutcome;
    market.timestamps.updated_at_ms = now;
    market.timestamps.settled_at_ms = now;

    this.markets.set(market.market_id, market);
    this.emit("market.settled", market);

    return market;
  }

  private emit<TKey extends keyof EngineEventMap>(eventName: TKey, payload: EngineEventMap[TKey]): void {
    this.bus.emit(eventName, payload);
    this.streamStatus.emitted_events += 1;
    this.streamStatus.last_event_name = String(eventName);
    this.streamStatus.updated_at_ms = Date.now();
  }
}
