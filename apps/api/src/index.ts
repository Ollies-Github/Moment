import cors from "@fastify/cors";
import Fastify from "fastify";
import { Server as SocketIOServer } from "socket.io";

import { MarketEngine } from "./engine";
import { registerRoutes } from "./routes";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

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

engine.start();
engine.seed();
registerRoutes(fastify, engine);

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
