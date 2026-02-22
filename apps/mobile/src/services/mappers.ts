import { z } from "zod";

import {
  betQuoteResponseSchema,
  betSchema,
  marketSchema,
  marketRejectedPayloadSchema,
  streamStatusSchema,
  walletSchema,
} from "@moment/shared";

export const parseMarkets = (input: unknown) => z.array(marketSchema).parse(input);
export const parseMarket = (input: unknown) => marketSchema.parse(input);
export const parseBets = (input: unknown) => z.array(betSchema).parse(input);
export const parseWallet = (input: unknown) => walletSchema.parse(input);
export const parseQuote = (input: unknown) => betQuoteResponseSchema.parse(input);
export const parseRejected = (input: unknown) => marketRejectedPayloadSchema.parse(input);
export const parseStreamStatus = (input: unknown) => streamStatusSchema.parse(input);
