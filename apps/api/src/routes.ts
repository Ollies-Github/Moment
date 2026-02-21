import type { FastifyInstance } from "fastify";

import { EngineError, type MarketEngine } from "./engine";
import {
  betRequestSchema,
  closeMarketBodySchema,
  marketIdParamSchema,
  quoteRequestSchema,
  settleMarketBodySchema,
  starterEventBodySchema,
  userIdParamSchema,
  type Selection,
} from "./types";

export const registerRoutes = (fastify: FastifyInstance, engine: MarketEngine): void => {
  fastify.get("/health", async () => ({
    status: "ok",
    service: "moment-api",
    timestamp_ms: Date.now(),
    uptime_s: process.uptime(),
  }));

  fastify.get("/markets/live", async () => engine.getLiveMarkets());

  fastify.get("/markets/:marketId", async (request, reply) => {
    const { marketId } = marketIdParamSchema.parse(request.params);
    const market = engine.getMarket(marketId);

    if (!market) {
      return reply.code(404).send({ message: "Market not found" });
    }

    return market;
  });

  fastify.post("/quotes", async (request, reply) => {
    const body = quoteRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    try {
      return engine.quoteBet(body.data);
    } catch (error) {
      if (error instanceof EngineError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/bets", async (request, reply) => {
    const body = betRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    const result = engine.placeBet(body.data);

    if (result.rejectedBet) {
      return reply.code(400).send(result.rejectedBet);
    }

    if (result.error) {
      return reply.code(400).send({ message: result.error });
    }

    return result.bet;
  });

  fastify.get("/bets/:userId", async (request) => {
    const { userId } = userIdParamSchema.parse(request.params);
    return engine.getBetsForUser(userId);
  });

  fastify.get("/users/:userId/wallet", async (request) => {
    const { userId } = userIdParamSchema.parse(request.params);
    return engine.getWallet(userId);
  });

  fastify.get("/events/stream-status", async () => {
    return engine.getStreamStatus();
  });

  fastify.post("/dev/simulate/starter-event", async (request, reply) => {
    const body = starterEventBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    const market = engine.simulateStarterEvent({
      sport: body.data.sport ?? "Football",
      event_type: body.data.event_type ?? "goal_disallowed_candidate",
      session_id: body.data.session_id,
      context: body.data.context,
    });

    return { ok: true, market };
  });

  fastify.post("/dev/simulate/close-market", async (request, reply) => {
    const body = closeMarketBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    const market = engine.closeMarket(body.data.market_id, body.data.reason ?? "manual_dev_trigger");
    if (!market) {
      return reply.code(404).send({ message: "Market not found" });
    }

    return { ok: true, market };
  });

  fastify.post("/dev/simulate/settle-market", async (request, reply) => {
    const body = settleMarketBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    const market = engine.getMarket(body.data.market_id);
    if (!market) {
      return reply.code(404).send({ message: "Market not found" });
    }

    const fallback: Selection = market.market_type === "binary_higher_lower" ? "HIGHER" : "YES";
    const settled = await engine.settleMarket(market.market_id, body.data.outcome ?? fallback);

    return { ok: true, market: settled };
  });

  fastify.post("/dev/simulate/reset", async () => {
    engine.reset();
    return { ok: true };
  });
};
