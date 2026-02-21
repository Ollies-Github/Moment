import { z } from "zod";

export const sportSchema = z.enum(["F1", "Stocks"]);
export const marketTypeSchema = z.enum(["binary_yes_no", "binary_higher_lower"]);
export const marketStatusSchema = z.enum(["open", "closed", "settled", "suspended"]);
export const selectionSchema = z.enum(["YES", "NO", "HIGHER", "LOWER"]);

export const betRequestSchema = z.object({
  user_id: z.string().min(1),
  market_id: z.string().min(1),
  selection: selectionSchema,
  stake: z.number().positive(),
});

export const quoteRequestSchema = betRequestSchema;

export const marketIdParamSchema = z.object({
  marketId: z.string().min(1),
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

export const starterEventBodySchema = z.object({
  sport: sportSchema.optional(),
  event_type: z.string().optional(),
  session_id: z.string().optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export const closeMarketBodySchema = z.object({
  market_id: z.string().min(1),
  reason: z.string().optional(),
});

export const settleMarketBodySchema = z.object({
  market_id: z.string().min(1),
  outcome: selectionSchema.optional(),
});

export type Sport = z.infer<typeof sportSchema>;
export type MarketType = z.infer<typeof marketTypeSchema>;
export type MarketStatus = z.infer<typeof marketStatusSchema>;
export type Selection = z.infer<typeof selectionSchema>;
export type BetRequest = z.infer<typeof betRequestSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export type AmmState = {
  yes_pool: number;
  no_pool: number;
  fee_bps: number;
  virtual_liquidity: number;
  total_fees_collected: number;
  total_volume: number;
  trade_count: number;
};

export type Market = {
  market_id: string;
  sport: Sport;
  session_id: string;
  market_type: MarketType;
  question: string;
  context: Record<string, unknown>;
  open_at_ms: number;
  settlement_key: string;
  starter_event_id: string;
  close_control: {
    mode: "backend_signal";
    closer_key: string;
  };
  market_making: {
    model: "binary_amm";
    initial_probability_yes: number;
    virtual_liquidity: number;
    fee_bps: number;
  };
  status: MarketStatus;
  amm_state: AmmState;
  prices: { yes: number; no: number };
  timestamps: {
    open_at_ms: number;
    updated_at_ms: number;
    closed_at_ms?: number;
    settled_at_ms?: number;
    suspended_at_ms?: number;
  };
  settlement_outcome?: Selection;
  safety: {
    max_open_duration_ms: number;
    expires_at_ms: number;
    timeout_triggered: boolean;
  };
};

export type BetStatus = "accepted" | "rejected" | "settled_won" | "settled_lost";

export type Bet = {
  bet_id: string;
  user_id: string;
  market_id: string;
  selection: Selection;
  stake: number;
  fee: number;
  effective_stake: number;
  accepted_price: number;
  potential_payout: number;
  status: BetStatus;
  payout?: number;
  created_at_ms: number;
  settled_at_ms?: number;
  rejection_reason?: string;
};

export type Wallet = {
  user_id: string;
  balance: number;
  updated_at_ms: number;
};

export type StreamStatus = {
  active_connections: number;
  emitted_events: number;
  last_event_name?: string;
  updated_at_ms: number;
};

export type StarterInput = {
  sport: Sport;
  event_type: string;
  session_id?: string;
  context?: Record<string, unknown>;
};

export type PublishEventName =
  | "market.opened"
  | "market.updated"
  | "market.closed"
  | "market.settled"
  | "market.suspended"
  | "bet.accepted"
  | "bet.rejected"
  | "wallet.updated"
  | "connection.state";
