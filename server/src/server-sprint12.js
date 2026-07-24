import { timingSafeEqual } from "node:crypto";

import {
  ExperienceTelemetryRegistry,
  readJsonRequest,
} from "./experience-telemetry.js";
import { startServer as startSprint11Server } from "./server-sprint11.js";

const RELEASE_VERSION = process.env.HEXA_RELEASE_VERSION ?? "0.12.0";
const RELEASE_SHA = process.env.HEXA_RELEASE_SHA ?? "unknown";

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function adminAuthorized(request) {
  const expected = process.env.HEXA_ADMIN_TOKEN ?? "";
  if (!expected) return false;
  const header = request.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function startServer({
  experienceTelemetry = new ExperienceTelemetryRegistry(),
  ...options
} = {}) {
  const instance = startSprint11Server(options);
  const {
    httpServer,
    metrics,
    logger,
    manager,
    identity,
    competition,
    governance,
    eventBus,
    presence,
    resilience,
    spectatorServer,
  } = instance;
  const baseRequestHandlers = httpServer.listeners("request");
  httpServer.removeAllListeners("request");

  httpServer.on("request", async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (url.pathname === "/health" && request.method === "GET") {
        json(response, 200, {
          ok: true,
          version: RELEASE_VERSION,
          releaseSha: RELEASE_SHA,
          design: "3.0",
          instanceId: eventBus.instanceId,
          roomStore: manager.store?.kind ?? "memory",
          identityStore: identity.kind ?? "memory",
          competitionStore: competition.kind ?? "memory",
          governanceStore: governance.kind ?? "memory",
          clusterBus: eventBus.kind ?? "memory",
          presenceStore: presence.kind ?? "memory",
          resilienceStore: resilience.kind,
          spectators: spectatorServer?.clients?.size ?? 0,
          experienceEvents: experienceTelemetry.total,
          ...(await presence.summary()),
          signature: "Tehkné Solutions",
        });
        return;
      }

      if (url.pathname === "/release" && request.method === "GET") {
        json(response, 200, {
          ok: true,
          version: RELEASE_VERSION,
          sha: RELEASE_SHA,
          design: "3.0",
          telemetry: "anonymous-operational-only",
          signature: "Tehkné Solutions",
        });
        return;
      }

      if (url.pathname === "/experience/events" && request.method === "POST") {
        const payload = await readJsonRequest(request);
        const accepted = experienceTelemetry.recordMany(payload.events);
        for (const event of accepted) {
          metrics?.inc?.("hexa_client_experience_events_total", {
            event: event.event,
            device: event.device,
            screen: event.screen,
          });
          if (event.durationMs !== null) {
            metrics?.inc?.("hexa_client_experience_duration_milliseconds_sum", { event: event.event }, event.durationMs);
            metrics?.inc?.("hexa_client_experience_duration_count", { event: event.event });
          }
        }
        json(response, 202, {
          ok: true,
          accepted: accepted.length,
          rejected: Math.max(0, (Array.isArray(payload.events) ? payload.events.length : 0) - accepted.length),
          signature: "Tehkné Solutions",
        });
        return;
      }

      if (url.pathname === "/admin/experience" && request.method === "GET") {
        if (!adminAuthorized(request)) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        json(response, 200, {
          release: { version: RELEASE_VERSION, sha: RELEASE_SHA, design: "3.0" },
          experience: experienceTelemetry.summary(),
          signature: "Tehkné Solutions",
        });
        return;
      }

      for (const handler of baseRequestHandlers) handler.call(httpServer, request, response);
    } catch (error) {
      logger?.warn?.("experience telemetry request failed", { path: url.pathname, code: error.code });
      if (!response.headersSent) {
        json(response, error.status ?? 500, {
          ok: false,
          error: error.code ?? "internal_error",
          message: error.status && error.status < 500 ? error.message : "request failed",
        });
      } else {
        response.end();
      }
    }
  });

  instance.experienceTelemetry = experienceTelemetry;
  instance.release = { version: RELEASE_VERSION, sha: RELEASE_SHA, design: "3.0" };
  return instance;
}
