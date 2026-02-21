import { describe, expect, it } from "vitest";

import {
  createAmmState,
  executeTrade,
  getImpliedProbabilities,
  getQuote,
} from "../src/index";

describe("pricing engine", () => {
  it("creates a valid AMM state", () => {
    const state = createAmmState(0.6, 1000, 150);
    const probs = getImpliedProbabilities(state);

    expect(state.yes_pool).toBe(600);
    expect(state.no_pool).toBe(400);
    expect(probs.yes).toBeCloseTo(0.6, 5);
    expect(probs.no).toBeCloseTo(0.4, 5);
  });

  it("returns quote with fee and payout", () => {
    const state = createAmmState(0.5, 1000, 100);
    const { quote } = getQuote(state, "YES", 10);

    expect(quote.fee).toBeCloseTo(0.1, 6);
    expect(quote.effective_stake).toBeCloseTo(9.9, 6);
    expect(quote.potential_payout).toBeGreaterThan(0);
    expect(quote.estimated_price_after).toBeGreaterThan(quote.estimated_price);
  });

  it("executes trade and mutates selected pool directionally", () => {
    const state = createAmmState(0.5, 1000, 0);
    const { nextState } = executeTrade(state, "NO", 25);

    expect(nextState.no_pool).toBeGreaterThan(state.no_pool);
    expect(nextState.trade_count).toBe(1);
    expect(nextState.total_volume).toBe(25);
  });
});
