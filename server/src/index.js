import { createCompetitionStore } from "./competition-store.js";
import { createIdentityStore } from "./identity-store.js";
import { createLogger } from "./logger.js";
import { MetricsRegistry } from "./metrics.js";
import { createRoomManager } from "./room-manager-factory.js";
import { createRoomStore } from "./room-store.js";
import { startServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const logger = createLogger();
const metrics = new MetricsRegistry();
const store = await createRoomStore();
const identity = await createIdentityStore();
const competition = await createCompetitionStore();
const manager = createRoomManager({ store });
const server = startServer({ port, manager, identity, competition, metrics, logger });

logger.info("server started", {
  port,
  websocket: `ws://0.0.0.0:${port}/ws`,
  cachedRooms: manager.rooms.size,
  roomStore: store.kind,
  identityStore: identity.kind,
  competitionStore: competition.kind,
});

function shutdown(signal) {
  logger.info("server shutting down", { signal });
  server.close().finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
