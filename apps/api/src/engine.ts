import { randomUUID } from "node:crypto";

import type {
  AmmState,
  Bet,
  BetRequest,
  Market,
  MarketType,
  PublishEventName,
  Selection,
  Sport,
  StarterInput,
  StreamStatus,
  Wallet,
} from "./types";

const DEFAULT_VIRTUAL_LIQUIDITY = 1000;
const DEFAULT_FEE_BPS = 120;
const DEFAULT_INITIAL_PROBABILITY = 0.5;
const DEFAULT_STARTING_BALANCE = 100;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

const normalizeSelection = (selection: Selection): "YES" | "NO" =>
  selection === "YES" || selection === "HIGHER" ? "YES" : "NO";

const validSelection = (marketType: MarketType, selection: Selection): boolean => {
  if (marketType === "binary_yes_no") {
    return selection === "YES" || selection === "NO";
  }
  return selection === "HIGHER" || selection === "LOWER";
};

const getImpliedProbabilities = (amm: AmmState): { yes: number; no: number } => {
  const total = amm.yes_pool + amm.no_pool;
  if (total <= 0) return { yes: 0.5, no: 0.5 };
  return { yes: amm.yes_pool / total, no: amm.no_pool / total };
};

const createAmmState = (initialProbabilityYes: number, virtualLiquidity: number, feeBps: number): AmmState => {
  const p = clamp(initialProbabilityYes, 0.01, 0.99);
  return {
    yes_pool: virtualLiquidity * p,
    no_pool: virtualLiquidity * (1 - p),
    fee_bps: feeBps,
    virtual_liquidity: virtualLiquidity,
    total_fees_collected: 0,
    total_volume: 0,
    trade_count: 0,
  };
};

const getQuote = (amm: AmmState, selection: Selection, stake: number) => {
  const side = normalizeSelection(selection);
  const before = getImpliedProbabilities(amm);
  const priceBefore = side === "YES" ? before.yes : before.no;
  const fee = stake * (amm.fee_bps / 10_000);
  const effectiveStake = stake - fee;

  const nextAmm: AmmState = {
    ...amm,
    total_fees_collected: amm.total_fees_collected + fee,
    total_volume: amm.total_volume + stake,
    trade_count: amm.trade_count + 1,
  };

  if (side === "YES") {
    nextAmm.yes_pool += effectiveStake;
  } else {
    nextAmm.no_pool += effectiveStake;
  }

  const after = getImpliedProbabilities(nextAmm);

  return {
    fee,
    effective_stake: effectiveStake,
    estimated_price: priceBefore,
    estimated_price_after: side === "YES" ? after.yes : after.no,
    potential_payout: effectiveStake / Math.max(priceBefore, 0.001),
    implied_probabilities_before: before,
    implied_probabilities_after: after,
    nextAmm,
  };
};

const F1_DRIVERS = [
  ["Norris", "Verstappen"],
  ["Leclerc", "Piastri"],
  ["Hamilton", "Russell"],
  ["Sainz", "Alonso"],
] as const;

const VOLATILE_STOCKS = ["TSLA", "NVDA", "COIN", "MSTR", "PLTR", "SMCI"] as const;

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export class EngineError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

export interface PlaceBetResult {
  bet?: Bet;
  rejectedBet?: Bet;
  error?: string;
}

interface MarketEngineOptions {
  maxOpenDurationMs?: number;
  safetySweepIntervalMs?: number;
}

interface MarketEngineDeps {
  publish: (eventName: PublishEventName, payload: unknown) => void;
  options?: MarketEngineOptions;
}

export class MarketEngine {
  private readonly publish: (eventName: PublishEventName, payload: unknown) => void;
  private readonly maxOpenDurationMs: number;
  private readonly safetySweepIntervalMs: number;

  private readonly markets = new Map<string, Market>();
  private readonly bets = new Map<string, Bet>();
  private readonly betsByUser = new Map<string, string[]>();
  private readonly wallets = new Map<string, Wallet>();

  private safetyHandle?: NodeJS.Timeout;

  private readonly streamStatus: StreamStatus = {
    active_connections: 0,
    emitted_events: 0,
    updated_at_ms: Date.now(),
  };

  constructor({ publish, options = {} }: MarketEngineDeps) {
    this.publish = publish;
    this.maxOpenDurationMs = options.maxOpenDurationMs ?? 90_000;
    this.safetySweepIntervalMs = options.safetySweepIntervalMs ?? 2_000;
  }

  start(): void {
    if (!this.safetyHandle) {
      this.safetyHandle = setInterval(() => {
        this.suspendStaleMarkets();
      }, this.safetySweepIntervalMs);
    }
  }

  stop(): void {
    if (this.safetyHandle) {
      clearInterval(this.safetyHandle);
      this.safetyHandle = undefined;
    }
  }

  getStreamStatus(): StreamStatus {
    return {
      ...this.streamStatus,
      updated_at_ms: Date.now(),
    };
  }

  setConnectionCount(count: number): void {
    this.streamStatus.active_connections = count;
    this.streamStatus.updated_at_ms = Date.now();
  }

  emitConnectionState(payload: { state: "connected" | "disconnected" | "reconnecting"; server_time_ms: number; socket_id?: string }): void {
    this.emit("connection.state", payload);
  }

  getLiveMarkets(): Market[] {
    return [...this.markets.values()].sort((a, b) => b.timestamps.updated_at_ms - a.timestamps.updated_at_ms);
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

  quoteBet(request: BetRequest) {
    const market = this.markets.get(request.market_id);
    if (!market) throw new EngineError("Market not found", 404);
    if (market.status !== "open") throw new EngineError("Market is not open", 400);
    if (!validSelection(market.market_type, request.selection)) {
      throw new EngineError("Selection does not match market type", 400);
    }

    const quote = getQuote(market.amm_state, request.selection, request.stake);

    return {
      market_id: market.market_id,
      selection: request.selection,
      stake: request.stake,
      fee: quote.fee,
      effective_stake: quote.effective_stake,
      estimated_price: quote.estimated_price,
      estimated_price_after: quote.estimated_price_after,
      potential_payout: quote.potential_payout,
      implied_probabilities_before: quote.implied_probabilities_before,
      implied_probabilities_after: quote.implied_probabilities_after,
      quoted_at_ms: Date.now(),
      expires_at_ms: Date.now() + 4_000,
    };
  }

  placeBet(request: BetRequest): PlaceBetResult {
    const market = this.markets.get(request.market_id);
    if (!market) {
      const rejectedBet = this.createRejectedBet(request, "Market not found");
      this.emit("bet.rejected", {
        market_id: rejectedBet.market_id,
        user_id: rejectedBet.user_id,
        reason: rejectedBet.rejection_reason,
        rejected_at_ms: Date.now(),
      });
      return { rejectedBet };
    }

    if (market.status !== "open") {
      return { error: `Market is ${market.status}` };
    }

    if (!validSelection(market.market_type, request.selection)) {
      return { error: "Selection does not match market type" };
    }

    const wallet = this.ensureWallet(request.user_id);
    if (wallet.balance < request.stake) {
      this.emit("bet.rejected", {
        market_id: request.market_id,
        user_id: request.user_id,
        reason: "Insufficient wallet balance",
        rejected_at_ms: Date.now(),
      });
      return { error: "Insufficient wallet balance" };
    }

    const quote = getQuote(market.amm_state, request.selection, request.stake);
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

    market.amm_state = quote.nextAmm;
    market.prices = getImpliedProbabilities(quote.nextAmm);
    market.timestamps.updated_at_ms = now;
    this.markets.set(market.market_id, market);

    wallet.balance -= bet.stake;
    wallet.updated_at_ms = now;
    this.wallets.set(wallet.user_id, wallet);

    this.bets.set(bet.bet_id, bet);
    this.betsByUser.set(bet.user_id, [...(this.betsByUser.get(bet.user_id) ?? []), bet.bet_id]);

    this.emit("market.updated", market);
    this.emit("bet.accepted", bet);
    this.emit("wallet.updated", wallet);

    return { bet };
  }

  simulateStarterEvent(input: StarterInput): Market {
    const market = this.buildMarketFromStarter(input);
    this.markets.set(market.market_id, market);
    this.emit("market.opened", market);
    return market;
  }

  closeMarket(marketId: string, reason = "backend_signal"): Market | undefined {
    const market = this.markets.get(marketId);
    if (!market) return undefined;
    if (market.status !== "open") return market;

    const now = Date.now();
    market.status = "closed";
    market.timestamps.closed_at_ms = now;
    market.timestamps.updated_at_ms = now;
    market.context = { ...market.context, close_reason: reason };
    this.markets.set(market.market_id, market);
    this.emit("market.closed", market);
    return market;
  }

  async settleMarket(marketId: string, outcome: Selection): Promise<Market | undefined> {
    const market = this.markets.get(marketId);
    if (!market) return undefined;

    if (market.status === "open") {
      this.closeMarket(marketId, "settlement_requested");
    }

    if (market.status !== "closed" && market.status !== "suspended") {
      return market;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    const oracleConfirmed = Math.random() <= 0.95;

    if (!oracleConfirmed) {
      market.status = "suspended";
      market.timestamps.updated_at_ms = Date.now();
      market.context = { ...market.context, oracle_rejection: true };
      this.markets.set(market.market_id, market);
      this.emit("market.suspended", market);
      return market;
    }

    const now = Date.now();
    const outcomeCanonical = normalizeSelection(outcome);

    for (const bet of this.bets.values()) {
      if (bet.market_id !== market.market_id || bet.status !== "accepted") continue;

      const won = normalizeSelection(bet.selection) === outcomeCanonical;
      bet.status = won ? "settled_won" : "settled_lost";
      bet.payout = won ? bet.potential_payout : 0;
      bet.settled_at_ms = now;
      this.bets.set(bet.bet_id, bet);

      const wallet = this.ensureWallet(bet.user_id);
      if (won) wallet.balance += bet.payout;
      wallet.updated_at_ms = now;
      this.wallets.set(wallet.user_id, wallet);
      this.emit("wallet.updated", wallet);
    }

    market.status = "settled";
    market.settlement_outcome = outcome;
    market.timestamps.settled_at_ms = now;
    market.timestamps.updated_at_ms = now;
    this.markets.set(market.market_id, market);
    this.emit("market.settled", market);

    return market;
  }

  reset(): void {
    this.markets.clear();
    this.bets.clear();
    this.betsByUser.clear();
    this.wallets.clear();
    this.seed();
  }

  seed(): void {
    const seedInputs: StarterInput[] = [
      { sport: "F1", event_type: "overtake_in_x_laps", context: { laps: 2, driver_a: "Norris", driver_b: "Verstappen" } },
      { sport: "F1", event_type: "overtake_in_x_laps", context: { laps: 3, driver_a: "Leclerc", driver_b: "Piastri" } },
      { sport: "Stocks", event_type: "stock_up_down_window", context: { symbol: "TSLA", window_minutes: 5 } },
      { sport: "Stocks", event_type: "stock_up_down_window", context: { symbol: "NVDA", window_minutes: 5 } },
    ];

    for (const starter of seedInputs) {
      const market = this.buildMarketFromStarter(starter);
      this.markets.set(market.market_id, market);
      this.emit("market.opened", market);
    }
  }

  private emit(eventName: PublishEventName, payload: unknown): void {
    this.publish(eventName, payload);
    this.streamStatus.emitted_events += 1;
    this.streamStatus.last_event_name = eventName;
    this.streamStatus.updated_at_ms = Date.now();
  }

  private createRejectedBet(request: BetRequest, reason: string): Bet {
    return {
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
      created_at_ms: Date.now(),
      rejection_reason: reason,
    };
  }

  private ensureWallet(userId: string): Wallet {
    const existing = this.wallets.get(userId);
    if (existing) return existing;

    const wallet: Wallet = {
      user_id: userId,
      balance: DEFAULT_STARTING_BALANCE,
      updated_at_ms: Date.now(),
    };

    this.wallets.set(userId, wallet);
    return wallet;
  }

  private buildMarketFromStarter(input: StarterInput): Market {
    const now = Date.now();
    const starter_event_id = randomUUID();
    const context = { ...(input.context ?? {}) };
    let market_type: MarketType = "binary_yes_no";
    let question = "Will this resolve to YES?";

    if (input.sport === "F1") {
      const [driverA, driverB] = Array.isArray(context.drivers)
        ? (context.drivers as string[])
        : pick(F1_DRIVERS);
      const laps =
        typeof context.laps === "number"
          ? Math.max(1, Math.floor(context.laps))
          : pick([1, 2, 3, 5]);
      const a = typeof context.driver_a === "string" ? context.driver_a : driverA;
      const b = typeof context.driver_b === "string" ? context.driver_b : driverB;
      context.driver_a = a;
      context.driver_b = b;
      context.laps = laps;
      question = `Will ${a} overtake ${b} within ${laps} laps?`;
    }

    if (input.sport === "Stocks") {
      market_type = "binary_higher_lower";
      const symbol = typeof context.symbol === "string" ? context.symbol.toUpperCase() : pick(VOLATILE_STOCKS);
      const windowMinutes =
        typeof context.window_minutes === "number"
          ? Math.max(1, Math.floor(context.window_minutes))
          : 5;
      context.symbol = symbol;
      context.window_minutes = windowMinutes;
      question = `Will price be HIGHER in the next ${windowMinutes} minutes?`;
    }

    const market_id = `mkt_${input.sport.toLowerCase()}_${now}_${starter_event_id.slice(0, 6)}`;

    const amm_state = createAmmState(
      DEFAULT_INITIAL_PROBABILITY,
      DEFAULT_VIRTUAL_LIQUIDITY,
      DEFAULT_FEE_BPS,
    );

    return {
      market_id,
      sport: input.sport,
      session_id: input.session_id ?? `${input.sport.toLowerCase()}-session-${now}`,
      market_type,
      question,
      context: {
        source_event_type: input.event_type,
        ...context,
      },
      open_at_ms: now,
      settlement_key: `${input.sport.toLowerCase()}_${input.event_type}`,
      starter_event_id,
      close_control: {
        mode: "backend_signal",
        closer_key: "mock_closer_v1",
      },
      market_making: {
        model: "binary_amm",
        initial_probability_yes: DEFAULT_INITIAL_PROBABILITY,
        virtual_liquidity: DEFAULT_VIRTUAL_LIQUIDITY,
        fee_bps: DEFAULT_FEE_BPS,
      },
      status: "open",
      amm_state,
      prices: getImpliedProbabilities(amm_state),
      timestamps: {
        open_at_ms: now,
        updated_at_ms: now,
      },
      safety: {
        max_open_duration_ms: this.maxOpenDurationMs,
        expires_at_ms: now + this.maxOpenDurationMs,
        timeout_triggered: false,
      },
    };
  }

  private suspendStaleMarkets(): void {
    const now = Date.now();

    for (const market of this.markets.values()) {
      if (market.status !== "open") continue;
      if (now <= market.safety.expires_at_ms) continue;

      market.status = "suspended";
      market.safety.timeout_triggered = true;
      market.timestamps.suspended_at_ms = now;
      market.timestamps.updated_at_ms = now;
      market.context = { ...market.context, suspension_reason: "safety_timeout" };
      this.markets.set(market.market_id, market);
      this.emit("market.suspended", market);
    }
  }
}
