import type { FastifyInstance } from "fastify";

import { EngineError, type MarketEngine } from "./engine";
import type { MockBetCloserService, MockBetStarterService } from "./mock-services";
import {
  betRequestSchema,
  closeMarketBodySchema,
  createUserBodySchema,
  loginBodySchema,
  marketIdParamSchema,
  quoteRequestSchema,
  scannerEventBodySchema,
  resolutionSignalBodySchema,
  settleMarketBodySchema,
  starterSignalBodySchema,
  starterEventBodySchema,
  userFundsBodySchema,
  userIdParamSchema,
  type Selection,
} from "./types";

export const registerRoutes = (
  fastify: FastifyInstance,
  engine: MarketEngine,
  starter: MockBetStarterService,
  closer: MockBetCloserService,
): void => {
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

    // Fire through the starter service so the full bus pipeline runs
    const event = starter.trigger({
      sport,
      event_type: body.data.event_type ?? fallbackEventType,
      session_id: body.data.session_id,
      context: body.data.context,
    });

    return { ok: true, event };
  });

  fastify.post("/dev/simulate/close-market", async (request, reply) => {
    const body = closeMarketBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    const market = engine.getMarket(body.data.market_id);
    if (!market) {
      return reply.code(404).send({ message: "Market not found" });
    }

    // Fire through the closer bus so auto-settle kicks in after 2s
    const trigger = closer.triggerClose(body.data.market_id, { reason: body.data.reason ?? "manual_dev_trigger" });
    return { ok: true, trigger };
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

  fastify.post("/scanner/events", async (request, reply) => {
    const body = scannerEventBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: body.error.message });
    }

    if (body.data.signal_type === "create_bet") {
      const result = engine.ingestStarterSignal({
        event_id: body.data.event_id,
        sport: body.data.sport,
        trigger_type: body.data.trigger_type,
        session_id: body.data.session_id,
        timestamp_ms: body.data.timestamp_ms,
        lap: body.data.lap,
        driver: body.data.driver,
        rival_driver: body.data.rival_driver,
        confidence: body.data.confidence,
        cooldown_key: body.data.cooldown_key,
        market_duration_ms: body.data.market_duration_ms,
        context: body.data.context,
      });

      return {
        ok: true,
        mode: "starter_pipeline",
        deduped: result.deduped,
        reason: result.reason,
        market: result.market,
      };
    }

    const market = engine.closeMarket(body.data.market_id, body.data.reason ?? "scanner_close_signal");
    if (!market) {
      return reply.code(404).send({ message: "Market not found" });
    }

    return {
      ok: true,
      mode: "direct_close",
      market,
      closed_by_event_id: body.data.event_id,
      closed_at_ms: body.data.timestamp_ms ?? Date.now(),
    };
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
