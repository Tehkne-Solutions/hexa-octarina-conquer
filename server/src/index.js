import { createIdentityStore } from "./identity-store.js";
import { createLogger } from "./logger.js";
import { MetricsRegistry } from "./metrics.js";
import { RoomManager } from "./room-manager.js";
import { createRoomStore } from "./room-store.js";
import { startServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const logger = createLogger();
const metrics = new MetricsRegistry();
const store = createRoomStore();
const identity = await createIdentityStore();
const manager = new RoomManager({ store });
const server = startServer({ port, manager, identity, metrics, logger });

logger.info("server started", {
  port,
  websocket: `ws://0.0.0.0:${port}/ws`,
  restoredRooms: manager.rooms.size,
  roomStore: store.kind,
  identityStore: identity.kind,
});

function shutdown(signal) {
  logger.info("server shutting down", { signal });
  server.close().finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
