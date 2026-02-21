import type { FastifyInstance } from "fastify";

import { EngineError, type MarketEngine } from "./engine";
import {
  betRequestSchema,
  closeMarketBodySchema,
  createUserBodySchema,
  loginBodySchema,
  marketIdParamSchema,
  quoteRequestSchema,
  resolutionSignalBodySchema,
  settleMarketBodySchema,
  starterSignalBodySchema,
  starterEventBodySchema,
  userFundsBodySchema,
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

  const handlePlacePick = async (request: any, reply: any) => {
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
  };

  fastify.post("/picks", handlePlacePick);

  fastify.get("/picks/:userId", async (request) => {
    const { userId } = userIdParamSchema.parse(request.params);
    return engine.getBetsForUser(userId);
  });

  fastify.get("/users/:userId/wallet", async (request) => {
    const { userId } = userIdParamSchema.parse(request.params);
    return engine.getWallet(userId);
  });

  fastify.get("/users/:userId", async (request) => {
    const { userId } = userIdParamSchema.parse(request.params);
    return engine.getUser(userId);
  });

  fastify.post("/auth/register", async (request, reply) => {
    const body = createUserBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    try {
      return engine.registerUser(body.data.username, body.data.pin);
    } catch (error) {
      if (error instanceof EngineError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/auth/login", async (request, reply) => {
    const body = loginBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    try {
      return engine.loginUser(body.data.username, body.data.pin);
    } catch (error) {
      if (error instanceof EngineError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/users/:userId/funds/add", async (request, reply) => {
    const { userId } = userIdParamSchema.parse(request.params);
    const body = userFundsBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    try {
      const wallet = engine.addFunds(userId, body.data.amount);
      return { wallet };
    } catch (error) {
      if (error instanceof EngineError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/users/:userId/funds/withdraw", async (request, reply) => {
    const { userId } = userIdParamSchema.parse(request.params);
    const body = userFundsBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    try {
      const wallet = engine.withdrawFunds(userId, body.data.amount);
      return { wallet };
    } catch (error) {
      if (error instanceof EngineError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.get("/events/stream-status", async () => {
    return engine.getStreamStatus();
  });

  fastify.post("/dev/simulate/starter-event", async (request, reply) => {
    const body = starterEventBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    const sport = body.data.sport ?? "F1";
    const fallbackEventType = sport === "Stocks" ? "stock_up_down_window" : "overtake_in_x_laps";

    const market = engine.simulateStarterEvent({
      sport,
      event_type: body.data.event_type ?? fallbackEventType,
      session_id: body.data.session_id,
      context: body.data.context,
      open_duration_ms: body.data.open_duration_ms,
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

  fastify.post("/starter/events", async (request, reply) => {
    const body = starterSignalBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    const result = engine.ingestStarterSignal(body.data);
    return {
      ok: true,
      deduped: result.deduped,
      reason: result.reason,
      market: result.market,
    };
  });

  fastify.post("/closer/resolutions", async (request, reply) => {
    const body = resolutionSignalBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    const market = await engine.ingestResolutionSignal(body.data);
    if (!market) {
      return reply.code(404).send({ message: "Market not found" });
    }

    return { ok: true, market };
  });
};
