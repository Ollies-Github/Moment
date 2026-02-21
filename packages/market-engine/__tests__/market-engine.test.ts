import { describe, expect, it } from "vitest";

import { MockBetBuilderService } from "@moment/ai-bet-builder";
import { MockBetCloserService } from "@moment/ai-bet-closer";
import { MockBetStarterService } from "@moment/ai-bet-starter";
import { TypedEventBus } from "@moment/event-bus";
import { MockOracleAdapter } from "@moment/oracle-adapter";
import type { EngineEventMap } from "@moment/shared";

import { MarketEngine } from "../src/index";

const setup = () => {
  const bus = new TypedEventBus<EngineEventMap>();
  const starter = new MockBetStarterService(bus);
  const builder = new MockBetBuilderService();
  const closer = new MockBetCloserService(bus);
  const oracle = new MockOracleAdapter({ reliability: 1, latencyMs: 0, random: () => 0.1 });
  const engine = new MarketEngine({
    bus,
    starter,
    builder,
    closer,
    oracle,
    options: {
      maxOpenDurationMs: 200,
      safetySweepIntervalMs: 50,
      defaultWalletBalance: 100,
    },
  });
  engine.start();
  return { engine };
};

describe("market engine lifecycle", () => {
  it("opens a market from starter events and accepts a bet", async () => {
    const { engine } = setup();

    engine.simulateStarterEvent({ sport: "Football", event_type: "penalty_awarded" });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const [market] = engine.getLiveMarkets();
    expect(market).toBeDefined();
    expect(market.status).toBe("open");

    const quote = engine.quoteBet({
      user_id: "user-1",
      market_id: market.market_id,
      selection: "YES",
      stake: 5,
    });

    expect(quote.market_id).toBe(market.market_id);
    const bet = engine.placeBet({
      user_id: "user-1",
      market_id: market.market_id,
      selection: "YES",
      stake: 5,
    });

    expect(bet.status).toBe("accepted");
    expect(engine.getWallet("user-1").balance).toBeLessThan(100);

    engine.stop();
  });

  it("closes and settles market with wallet payout path", async () => {
    const { engine } = setup();

    engine.simulateStarterEvent({ sport: "F1", event_type: "overtake_attempt" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const [market] = engine.getLiveMarkets();

    engine.placeBet({
      user_id: "user-2",
      market_id: market.market_id,
      selection: "YES",
      stake: 10,
    });

    engine.simulateCloseMarket(market.market_id, "lap_finished");
    const closed = engine.getMarket(market.market_id);
    expect(closed?.status).toBe("closed");

    await engine.simulateSettleMarket(market.market_id, "YES");
    const settled = engine.getMarket(market.market_id);
    expect(settled?.status).toBe("settled");

    const bets = engine.getBetsForUser("user-2");
    expect(bets[0]?.status).toBe("settled_won");
    expect(engine.getWallet("user-2").balance).toBeGreaterThan(90);

    engine.stop();
  });

  it("suspends stale markets with safety timeout", async () => {
    const { engine } = setup();

    engine.simulateStarterEvent({ sport: "Football", event_type: "var_review" });
    await new Promise((resolve) => setTimeout(resolve, 350));

    const [market] = engine.getLiveMarkets();
    expect(market.status).toBe("suspended");
    expect(market.safety.timeout_triggered).toBe(true);

    engine.stop();
  });
});
