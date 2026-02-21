import { z } from "zod";

export const sportSchema = z.enum(["F1", "Football"]);
export const marketTypeSchema = z.enum(["binary_yes_no", "binary_higher_lower"]);
export const marketStatusSchema = z.enum([
  "open",
  "closing",
  "closed",
  "settled",
  "suspended",
  "void",
]);

export const selectionSchema = z.enum(["YES", "NO", "HIGHER", "LOWER"]);

export const marketMakingSchema = z.object({
  model: z.literal("binary_amm"),
  initial_probability_yes: z.number().min(0.01).max(0.99),
  virtual_liquidity: z.number().positive(),
  fee_bps: z.number().min(0).max(5000),
});

export const closeControlSchema = z.object({
  mode: z.literal("backend_signal"),
  closer_key: z.string().min(1),
});

export const marketOpenPayloadSchema = z.object({
  market_id: z.string().min(1),
  sport: sportSchema,
  session_id: z.string().min(1),
  market_type: marketTypeSchema,
  question: z.string().min(1),
  context: z.record(z.string(), z.any()).default({}),
  open_at_ms: z.number().int().nonnegative(),
  settlement_key: z.string().min(1),
  starter_event_id: z.string().min(1),
  market_making: marketMakingSchema,
  close_control: closeControlSchema,
});

export const ammStateSchema = z.object({
  yes_pool: z.number().nonnegative(),
  no_pool: z.number().nonnegative(),
  virtual_liquidity: z.number().positive(),
  fee_bps: z.number().min(0),
  total_fees_collected: z.number().nonnegative(),
  total_volume: z.number().nonnegative(),
  trade_count: z.number().int().nonnegative(),
});

export const marketPricesSchema = z.object({
  yes: z.number().min(0).max(1),
  no: z.number().min(0).max(1),
});

export const marketTimestampsSchema = z.object({
  open_at_ms: z.number().int(),
  updated_at_ms: z.number().int(),
  closed_at_ms: z.number().int().optional(),
  settled_at_ms: z.number().int().optional(),
  suspended_at_ms: z.number().int().optional(),
});

export const marketSafetySchema = z.object({
  max_open_duration_ms: z.number().int().positive(),
  expires_at_ms: z.number().int().positive(),
  timeout_triggered: z.boolean().default(false),
});

export const marketSchema = marketOpenPayloadSchema.extend({
  status: marketStatusSchema,
  amm_state: ammStateSchema,
  prices: marketPricesSchema,
  timestamps: marketTimestampsSchema,
  settlement_outcome: selectionSchema.optional(),
  safety: marketSafetySchema,
});

export const betRequestSchema = z.object({
  user_id: z.string().min(1),
  market_id: z.string().min(1),
  selection: selectionSchema,
  stake: z.number().positive(),
});

export const betQuoteRequestSchema = z.object({
  user_id: z.string().min(1),
  market_id: z.string().min(1),
  selection: selectionSchema,
  stake: z.number().positive(),
});

export const betQuoteResponseSchema = z.object({
  market_id: z.string().min(1),
  selection: selectionSchema,
  stake: z.number().positive(),
  fee: z.number().nonnegative(),
  effective_stake: z.number().nonnegative(),
  estimated_price: z.number().positive(),
  estimated_price_after: z.number().positive(),
  potential_payout: z.number().nonnegative(),
  implied_probabilities_before: marketPricesSchema,
  implied_probabilities_after: marketPricesSchema,
  quoted_at_ms: z.number().int(),
  expires_at_ms: z.number().int(),
});

export const betStatusSchema = z.enum([
  "accepted",
  "rejected",
  "settled_won",
  "settled_lost",
  "voided",
]);

export const betSchema = z.object({
  bet_id: z.string().min(1),
  user_id: z.string().min(1),
  market_id: z.string().min(1),
  selection: selectionSchema,
  stake: z.number().positive(),
  fee: z.number().nonnegative(),
  effective_stake: z.number().nonnegative(),
  accepted_price: z.number().positive(),
  potential_payout: z.number().nonnegative(),
  status: betStatusSchema,
  payout: z.number().nonnegative().optional(),
  created_at_ms: z.number().int(),
  settled_at_ms: z.number().int().optional(),
  rejection_reason: z.string().optional(),
});

export const walletSchema = z.object({
  user_id: z.string().min(1),
  balance: z.number(),
  updated_at_ms: z.number().int(),
});

export const betStarterEventSchema = z.object({
  starter_event_id: z.string().min(1),
  sport: sportSchema,
  session_id: z.string().min(1),
  event_type: z.string().min(1),
  timestamp_ms: z.number().int(),
  context: z.record(z.string(), z.any()).default({}),
});

export const betCloseTriggerSchema = z.object({
  market_id: z.string().min(1),
  reason: z.string().min(1),
  triggered_at_ms: z.number().int(),
  closer_key: z.string().min(1),
});

export const oracleSettlementResultSchema = z.object({
  market_id: z.string().min(1),
  proposed_outcome: selectionSchema,
  confirmed: z.boolean(),
  outcome: selectionSchema.optional(),
  settled_at_ms: z.number().int(),
  source: z.string().min(1),
  reliability: z.number().min(0).max(1),
});

export const marketRejectedPayloadSchema = z.object({
  market_id: z.string().min(1),
  user_id: z.string().min(1),
  reason: z.string().min(1),
  rejected_at_ms: z.number().int(),
});

export const streamStatusSchema = z.object({
  active_connections: z.number().int().nonnegative(),
  emitted_events: z.number().int().nonnegative(),
  last_event_name: z.string().optional(),
  updated_at_ms: z.number().int(),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("moment-api"),
  uptime_s: z.number().nonnegative(),
  timestamp_ms: z.number().int(),
});

export const connectionStatePayloadSchema = z.object({
  state: z.enum(["connected", "disconnected", "reconnecting"]),
  server_time_ms: z.number().int(),
  socket_id: z.string().optional(),
});

export const wsEventPayloadSchemas = {
  "market.opened": marketSchema,
  "market.updated": marketSchema,
  "market.closed": marketSchema,
  "market.settled": marketSchema,
  "market.suspended": marketSchema,
  "bet.accepted": betSchema,
  "bet.rejected": marketRejectedPayloadSchema,
  "wallet.updated": walletSchema,
  "connection.state": connectionStatePayloadSchema,
} as const;

export type Sport = z.infer<typeof sportSchema>;
export type MarketType = z.infer<typeof marketTypeSchema>;
export type MarketStatus = z.infer<typeof marketStatusSchema>;
export type Selection = z.infer<typeof selectionSchema>;
export type MarketOpenPayload = z.infer<typeof marketOpenPayloadSchema>;
export type AmmState = z.infer<typeof ammStateSchema>;
export type Market = z.infer<typeof marketSchema>;
export type BetRequest = z.infer<typeof betRequestSchema>;
export type BetQuoteRequest = z.infer<typeof betQuoteRequestSchema>;
export type BetQuoteResponse = z.infer<typeof betQuoteResponseSchema>;
export type Bet = z.infer<typeof betSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type BetStarterEvent = z.infer<typeof betStarterEventSchema>;
export type BetCloseTrigger = z.infer<typeof betCloseTriggerSchema>;
export type OracleSettlementResult = z.infer<typeof oracleSettlementResultSchema>;
export type StreamStatus = z.infer<typeof streamStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type MarketRejectedPayload = z.infer<typeof marketRejectedPayloadSchema>;
export type ConnectionStatePayload = z.infer<typeof connectionStatePayloadSchema>;

export type WsEventName = keyof typeof wsEventPayloadSchemas;

export interface EngineEventMap {
  "starter.detected": BetStarterEvent;
  "closer.triggered": BetCloseTrigger;
  "market.opened": Market;
  "market.updated": Market;
  "market.closed": Market;
  "market.settled": Market;
  "market.suspended": Market;
  "bet.accepted": Bet;
  "bet.rejected": MarketRejectedPayload;
  "wallet.updated": Wallet;
  "connection.state": ConnectionStatePayload;
}
