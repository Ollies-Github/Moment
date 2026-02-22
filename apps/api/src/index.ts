import cors from "@fastify/cors";
import { MockBetCloserService } from "@moment/ai-bet-closer";
import { MockBetStarterService } from "@moment/ai-bet-starter";
import { TypedEventBus } from "@moment/event-bus";
import type { BetCloseTrigger, BetStarterEvent, EngineEventMap } from "@moment/shared";
import Fastify from "fastify";
import { Server as SocketIOServer } from "socket.io";

import { MarketEngine } from "./engine";
import { registerRoutes } from "./routes";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

// Shared event bus wiring all AI services together
const bus = new TypedEventBus<EngineEventMap>();

const starter = new MockBetStarterService(bus, {
  // Set STARTER_INTERVAL_MS env var to auto-fire (e.g. 60000 for 1 min).
  // Default 0 = only fire when /dev/simulate/trigger-starter is called.
  intervalMs: Number(process.env.STARTER_INTERVAL_MS ?? 0),
});

const closer = new MockBetCloserService(bus);

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: true, credentials: true });

const io = new SocketIOServer(fastify.server, {
  cors: { origin: "*", credentials: true },
  transports: ["websocket", "polling"],
});

const engine = new MarketEngine({
  options: {
    maxOpenDurationMs: 90_000,
    safetySweepIntervalMs: 2_000,
  },
  publish: (eventName, payload) => {
    io.emit(eventName, payload);
  },
});

// starter.detected → create market via simulateStarterEvent (same path as /dev/simulate/starter-event)
bus.on("starter.detected", (event: BetStarterEvent) => {
  const sport = event.sport === "F1" || event.sport === "Stocks" ? event.sport : "F1";
  engine.simulateStarterEvent({
    sport,
    event_type: event.event_type,
    session_id: event.session_id,
    context: event.context,
  });
});

// closer.triggered → close the market, then settle with a random outcome 2 s later
bus.on("closer.triggered", async (trigger: BetCloseTrigger) => {
  const market = engine.getMarket(trigger.market_id);
  if (!market) return;

  engine.closeMarket(trigger.market_id, trigger.reason);

  await new Promise((resolve) => setTimeout(resolve, 2_000));

  const outcome =
    market.market_type === "binary_higher_lower"
      ? (Math.random() < 0.5 ? "HIGHER" : "LOWER")
      : (Math.random() < 0.5 ? "YES" : "NO");

  await engine.settleMarket(trigger.market_id, outcome as "YES" | "NO" | "HIGHER" | "LOWER");
});

engine.start();
// No engine.seed() — markets only appear when the starter fires a real trigger.

registerRoutes(fastify, engine, starter, closer);

io.on("connection", (socket) => {
  engine.setConnectionCount(io.engine.clientsCount);

  socket.emit("connection.state", {
    state: "connected",
    server_time_ms: Date.now(),
    socket_id: socket.id,
  });

  socket.on("disconnect", () => {
    engine.setConnectionCount(io.engine.clientsCount);
    engine.emitConnectionState({
      state: "disconnected",
      server_time_ms: Date.now(),
      socket_id: socket.id,
    });
  });
});

const shutdown = async (): Promise<void> => {
  starter.stop();
  engine.stop();
  io.close();
  await fastify.close();
};

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`API listening at http://${HOST}:${PORT}`);
} catch (error) {
  fastify.log.error(error);
  await shutdown();
  process.exit(1);
}
