import { MemoryCampaignStore } from "./campaign-store.js";
import { ProtocolError } from "./protocol.js";
import { startServer as startWebServer } from "./server-web.js";

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type, x-account-id",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request, maxBytes = 32_768) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw new ProtocolError("PAYLOAD_TOO_LARGE", "campaign request body is too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ProtocolError("INVALID_JSON", "campaign request body is not valid JSON");
  }
}

function credentialsFromRequest(request, body = {}) {
  const accountId = body.accountId ?? request.headers["x-account-id"] ?? null;
  const authorization = request.headers.authorization ?? "";
  const accessToken = body.accessToken ?? (authorization.startsWith("Bearer ") ? authorization.slice(7) : null);
  return { accountId, accessToken };
}

async function optionalAccount(identity, credentials) {
  if (!credentials.accountId && !credentials.accessToken) return null;
  if (!credentials.accountId || !credentials.accessToken) {
    throw new ProtocolError("INVALID_MESSAGE", "accountId and accessToken must be supplied together");
  }
  return identity.authenticate(credentials.accountId, credentials.accessToken);
}

export function startServer({ campaign = new MemoryCampaignStore(), ...options } = {}) {
  const instance = startWebServer(options);
  const { httpServer, identity, manager, metrics, logger } = instance;
  const existingHandlers = httpServer.listeners("request");
  httpServer.removeAllListeners("request");

  httpServer.on("request", async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/campaign")) {
      for (const handler of existingHandlers) handler.call(httpServer, request, response);
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type, x-account-id",
        "access-control-allow-methods": "GET, POST, OPTIONS",
      });
      response.end();
      return;
    }

    try {
      if (url.pathname === "/campaign/catalog" && request.method === "GET") {
        const credentials = credentialsFromRequest(request);
        const account = await optionalAccount(identity, credentials);
        json(response, 200, await campaign.getCatalog(account?.id ?? null));
        return;
      }

      if (url.pathname === "/campaign/progress" && request.method === "GET") {
        const credentials = credentialsFromRequest(request);
        const account = await optionalAccount(identity, credentials);
        if (!account) throw new ProtocolError("ACCOUNT_REQUIRED", "an authenticated account is required");
        json(response, 200, {
          progress: await campaign.getProgress(account.id),
          catalog: await campaign.getCatalog(account.id),
        });
        return;
      }

      if (url.pathname === "/campaign/start" && request.method === "POST") {
        const body = await readJsonBody(request);
        const credentials = credentialsFromRequest(request, body);
        const account = await optionalAccount(identity, credentials);
        const missionId = String(body.missionId ?? "").trim();
        if (!missionId) throw new ProtocolError("MISSION_REQUIRED", "missionId is required");
        await campaign.assertMissionUnlocked(account?.id ?? null, missionId);
        const playerName = account?.displayName ?? String(body.playerName ?? "Arquiteto").trim() || "Arquiteto";
        const result = await manager.createCampaignRoom({
          missionId,
          playerName,
          accountId: account?.id ?? null,
        });
        metrics?.inc?.("hexa_campaign_started_total", { mission: missionId });
        json(response, 201, {
          roomId: result.room.id,
          playerId: result.player.id,
          sessionToken: result.player.sessionToken,
          snapshot: result.room.snapshot(),
          privateState: result.room.privateStateFor(result.player.id),
          signature: "Tehkné Solutions",
        });
        return;
      }

      if (url.pathname === "/campaign/complete" && request.method === "POST") {
        const body = await readJsonBody(request);
        const credentials = credentialsFromRequest(request, body);
        const account = await optionalAccount(identity, credentials);
        if (!account) throw new ProtocolError("ACCOUNT_REQUIRED", "an authenticated account is required");
        const room = await manager.getRoom(String(body.roomId ?? ""));
        const result = room.campaignResult();
        if (!result || room.mode !== "campaign") throw new ProtocolError("CAMPAIGN_NOT_FINISHED", "campaign mission is not finished");
        if (result.accountId !== account.id) throw new ProtocolError("CAMPAIGN_ACCOUNT_MISMATCH", "mission does not belong to this account");
        const recorded = await campaign.recordResult(account.id, result);
        metrics?.inc?.("hexa_campaign_completed_total", { mission: result.missionId, success: String(result.success) });
        json(response, 200, {
          ...recorded,
          result,
          catalog: await campaign.getCatalog(account.id),
        });
        return;
      }

      json(response, 404, { ok: false, error: "campaign_not_found" });
    } catch (error) {
      const status = error instanceof ProtocolError || error?.code ? 400 : 500;
      logger?.warn?.("campaign request failed", { path: url.pathname, error });
      json(response, status, {
        ok: false,
        error: error?.code ?? "internal_error",
        message: error instanceof Error ? error.message : "campaign request failed",
      });
    }
  });

  const baseClose = instance.close.bind(instance);
  instance.campaign = campaign;
  instance.close = async () => {
    await campaign.close?.();
    await baseClose();
  };
  return instance;
}
