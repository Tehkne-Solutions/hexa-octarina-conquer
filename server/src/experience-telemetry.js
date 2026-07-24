const ALLOWED_EVENTS = new Set([
  "app_boot",
  "screen_view",
  "realm_status",
  "pwa_state",
  "client_error",
  "performance",
  "battle_session",
]);

const ALLOWED_SCREENS = new Set([
  "home",
  "campaign-map",
  "campaign-living",
  "campaign-server",
  "multiplayer",
  "collection",
  "profile",
  "settings",
  "unknown",
]);

const ALLOWED_DEVICES = new Set(["mobile", "tablet", "notebook", "desktop", "unknown"]);
const ALLOWED_REALMS = new Set(["loading", "online", "offline", "unknown"]);

function boundedString(value, fallback, maxLength = 64) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._:-]/g, "-");
  return cleaned.slice(0, maxLength) || fallback;
}

function boundedNumber(value, fallback = null, min = 0, max = 3_600_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safeEnum(value, allowed, fallback) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

export function sanitizeExperienceEvent(input, now = Date.now()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const event = safeEnum(input.event, ALLOWED_EVENTS, null);
  if (!event) return null;
  return {
    event,
    screen: safeEnum(input.screen, ALLOWED_SCREENS, "unknown"),
    device: safeEnum(input.device, ALLOWED_DEVICES, "unknown"),
    realm: safeEnum(input.realm, ALLOWED_REALMS, "unknown"),
    release: boundedString(input.release, "unknown", 48),
    value: boundedString(input.value, "none", 48),
    durationMs: boundedNumber(input.durationMs),
    occurredAt: boundedNumber(input.occurredAt, now, now - 86_400_000, now + 60_000),
  };
}

function groupKey(event) {
  return [event.event, event.screen, event.device, event.realm, event.release, event.value].join("|");
}

export class ExperienceTelemetryRegistry {
  constructor({ clock = () => Date.now(), maxGroups = 500 } = {}) {
    this.clock = clock;
    this.maxGroups = maxGroups;
    this.startedAt = this.clock();
    this.total = 0;
    this.rejected = 0;
    this.groups = new Map();
  }

  record(input) {
    const event = sanitizeExperienceEvent(input, this.clock());
    if (!event) {
      this.rejected += 1;
      return null;
    }
    const key = groupKey(event);
    if (!this.groups.has(key) && this.groups.size >= this.maxGroups) {
      this.rejected += 1;
      return null;
    }
    const current = this.groups.get(key) ?? {
      event: event.event,
      screen: event.screen,
      device: event.device,
      realm: event.realm,
      release: event.release,
      value: event.value,
      count: 0,
      durationCount: 0,
      durationMsSum: 0,
      durationMsMax: 0,
      firstSeenAt: event.occurredAt,
      lastSeenAt: event.occurredAt,
    };
    current.count += 1;
    current.lastSeenAt = Math.max(current.lastSeenAt, event.occurredAt);
    if (event.durationMs !== null) {
      current.durationCount += 1;
      current.durationMsSum += event.durationMs;
      current.durationMsMax = Math.max(current.durationMsMax, event.durationMs);
    }
    this.groups.set(key, current);
    this.total += 1;
    return event;
  }

  recordMany(inputs) {
    const accepted = [];
    for (const input of Array.isArray(inputs) ? inputs.slice(0, 50) : []) {
      const event = this.record(input);
      if (event) accepted.push(event);
    }
    return accepted;
  }

  summary() {
    return {
      startedAt: this.startedAt,
      generatedAt: this.clock(),
      total: this.total,
      rejected: this.rejected,
      groups: [...this.groups.values()]
        .map((group) => ({
          ...group,
          durationMsAverage: group.durationCount > 0
            ? Math.round(group.durationMsSum / group.durationCount)
            : null,
        }))
        .sort((left, right) => right.count - left.count || right.lastSeenAt - left.lastSeenAt),
      signature: "Tehkné Solutions",
    };
  }
}

export async function readJsonRequest(request, { maxBytes = 16_384 } = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw Object.assign(new Error("request body too large"), { code: "PAYLOAD_TOO_LARGE", status: 413 });
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("invalid JSON payload"), { code: "INVALID_JSON", status: 400 });
  }
}
