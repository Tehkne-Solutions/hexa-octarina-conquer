import { MemoryClusterBus } from "./cluster-bus.js";
import { MemoryCompetitionStore } from "./competition-memory.js";
import { MemoryGovernanceStore } from "./governance-store.js";
import { MemoryIdentityStore } from "./identity-memory.js";
import { createLogger } from "./logger.js";
import { MetricsRegistry } from "./metrics.js";
import { MemoryPresenceStore } from "./presence-store.js";
import { createRecoveryProvider } from "./recovery-provider.js";
import { MemoryResilienceStore } from "./resilience-store.js";
import { RoomManager } from "./room-manager.js";
import { startServer as startSprint11Server } from "./server-sprint11.js";

export function startServer(options = {}) {
  const eventBus = options.eventBus ?? new MemoryClusterBus();
  const competition = options.competition ?? new MemoryCompetitionStore();
  const manager = options.manager ?? new RoomManager();
  const identity = options.identity ?? new MemoryIdentityStore();
  const presence = options.presence ?? new MemoryPresenceStore({ instanceId: eventBus.instanceId });
  const governance = options.governance ?? new MemoryGovernanceStore({ competition });
  const resilience = options.resilience ?? new MemoryResilienceStore();
  const logger = options.logger ?? createLogger();
  const metrics = options.metrics ?? new MetricsRegistry();
  const recoveryProvider = options.recoveryProvider ?? createRecoveryProvider({ logger });

  return startSprint11Server({
    ...options,
    manager,
    identity,
    competition,
    eventBus,
    presence,
    governance,
    resilience,
    logger,
    metrics,
    recoveryProvider,
  });
}
