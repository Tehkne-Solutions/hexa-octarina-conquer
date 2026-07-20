import { createClusterBus } from "./cluster-bus.js";
import { createCompetitionStore } from "./competition-store.js";
import { createGovernanceStore } from "./governance-store.js";
import { createIdentityStore } from "./identity-store.js";
import { createLogger } from "./logger.js";
import { MetricsRegistry } from "./metrics.js";
import { createPresenceStore } from "./presence-store.js";
import { createRecoveryProvider } from "./recovery-provider.js";
import { createResilienceStore } from "./resilience-store.js";
import { createRoomManager } from "./room-manager-factory.js";
import { createRoomStore } from "./room-store.js";
import { startServer } from "./server-web.js";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const logger = createLogger();
const metrics = new MetricsRegistry();
const store = await createRoomStore();
const identity = await createIdentityStore();
const competition = await createCompetitionStore();
const eventBus = await createClusterBus();
const presence = await createPresenceStore({ instanceId: eventBus.instanceId });
const governance = await createGovernanceStore({ competition });
const resilience = await createResilienceStore();
const recoveryProvider = createRecoveryProvider({ logger });
const manager = createRoomManager({ store });
const server = startServer({
  port,
  manager,
  identity,
  competition,
  eventBus,
  presence,
  governance,
  resilience,
  recoveryProvider,
  metrics,
  logger,
});

logger.info("server started", {
  port,
  webClient: process.env.HEXA_WEB_ROOT ?? null,
  websocket: `ws://0.0.0.0:${port}/ws`,
  spectatorWebsocket: `ws://0.0.0.0:${port}/spectator?roomId=ROOM_ID`,
  adminPanel: `http://0.0.0.0:${port}/admin`,
  instanceId: eventBus.instanceId,
  cachedRooms: manager.rooms.size,
  roomStore: store.kind,
  identityStore: identity.kind,
  competitionStore: competition.kind,
  governanceStore: governance.kind,
  clusterBus: eventBus.kind,
  presenceStore: presence.kind,
  resilienceStore: resilience.kind,
  recoveryProvider: recoveryProvider.kind,
});

function shutdown(signal) {
  logger.info("server shutting down", { signal, instanceId: eventBus.instanceId });
  server.close().finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
