import type { AmmState, BetQuoteResponse, Selection } from "@moment/shared";

const clampProbability = (value: number): number => {
  return Math.max(0.001, Math.min(0.999, value));
};

const normalizeSelection = (selection: Selection): "YES" | "NO" => {
  if (selection === "YES" || selection === "HIGHER") {
    return "YES";
  }
  return "NO";
};

export interface QuoteResult {
  quote: BetQuoteResponse;
  nextState: AmmState;
}

export const createAmmState = (
  initialProbabilityYes: number,
  virtualLiquidity: number,
  feeBps: number,
): AmmState => {
  const clamped = clampProbability(initialProbabilityYes);
  const yesPool = virtualLiquidity * clamped;
  const noPool = virtualLiquidity * (1 - clamped);

  return {
    yes_pool: yesPool,
    no_pool: noPool,
    virtual_liquidity: virtualLiquidity,
    fee_bps: feeBps,
    total_fees_collected: 0,
    total_volume: 0,
    trade_count: 0,
  };
};

export const getImpliedProbabilities = (ammState: AmmState): { yes: number; no: number } => {
  const total = ammState.yes_pool + ammState.no_pool;
  if (total <= 0) {
    return { yes: 0.5, no: 0.5 };
  }
  return {
    yes: ammState.yes_pool / total,
    no: ammState.no_pool / total,
  };
};

export const getQuote = (ammState: AmmState, selection: Selection, stake: number): QuoteResult => {
  const now = Date.now();
  const side = normalizeSelection(selection);
  const before = getImpliedProbabilities(ammState);
  const selectedPrice = side === "YES" ? before.yes : before.no;
  const feeRate = ammState.fee_bps / 10_000;
  const fee = stake * feeRate;
  const effectiveStake = stake - fee;

  const nextState: AmmState = {
    ...ammState,
    yes_pool: ammState.yes_pool,
    no_pool: ammState.no_pool,
    total_fees_collected: ammState.total_fees_collected + fee,
    total_volume: ammState.total_volume + stake,
    trade_count: ammState.trade_count + 1,
  };

  if (side === "YES") {
    nextState.yes_pool += effectiveStake;
  } else {
    nextState.no_pool += effectiveStake;
  }

  const after = getImpliedProbabilities(nextState);
  const afterSelectedPrice = side === "YES" ? after.yes : after.no;
  const shares = effectiveStake / Math.max(selectedPrice, 0.001);

  return {
    quote: {
      market_id: "",
      selection,
      stake,
      fee,
      effective_stake: effectiveStake,
      estimated_price: selectedPrice,
      estimated_price_after: afterSelectedPrice,
      potential_payout: shares,
      implied_probabilities_before: before,
      implied_probabilities_after: after,
      quoted_at_ms: now,
      expires_at_ms: now + 4_000,
    },
    nextState,
  };
};

export const executeTrade = (ammState: AmmState, selection: Selection, stake: number): QuoteResult => {
  return getQuote(ammState, selection, stake);
};
