export class NullRecoveryProvider {
  constructor() {
    this.kind = "none";
  }

  async deliver() {
    return { delivered: false, provider: this.kind };
  }

  async close() {}
}

export class ConsoleRecoveryProvider {
  constructor({ logger = console } = {}) {
    this.kind = "console";
    this.logger = logger;
  }

  async deliver({ account, recoveryCode, expiresAt }) {
    this.logger.info?.("account recovery code generated", {
      accountId: account.id,
      handle: account.handle,
      recoveryCode,
      expiresAt,
      signature: "Tehkné Solutions",
    });
    return { delivered: true, provider: this.kind };
  }

  async close() {}
}

export class WebhookRecoveryProvider {
  constructor({ url, secret = "", timeoutMs = 8_000 } = {}) {
    if (!url) throw new Error("HEXA_RECOVERY_WEBHOOK_URL is required for webhook recovery provider");
    this.kind = "webhook";
    this.url = url;
    this.secret = secret;
    this.timeoutMs = timeoutMs;
  }

  async deliver({ account, recoveryCode, expiresAt }) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Hexa-Octarina-Conquer/0.10.0 Tehkne-Solutions",
        ...(this.secret ? { authorization: `Bearer ${this.secret}` } : {}),
      },
      body: JSON.stringify({
        type: "account.recovery",
        account: {
          id: account.id,
          handle: account.handle,
          displayName: account.displayName,
        },
        recoveryCode,
        expiresAt,
        product: "Hexa Octarina Conquer",
        signature: "Tehkné Solutions",
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`Recovery webhook failed with HTTP ${response.status}`);
    return { delivered: true, provider: this.kind };
  }

  async close() {}
}

export function createRecoveryProvider({
  mode = process.env.HEXA_RECOVERY_PROVIDER ?? (process.env.NODE_ENV === "production" ? "none" : "console"),
  logger = console,
} = {}) {
  if (mode === "none") return new NullRecoveryProvider();
  if (mode === "console") return new ConsoleRecoveryProvider({ logger });
  if (mode === "webhook") {
    return new WebhookRecoveryProvider({
      url: process.env.HEXA_RECOVERY_WEBHOOK_URL,
      secret: process.env.HEXA_RECOVERY_WEBHOOK_SECRET ?? "",
      timeoutMs: Number(process.env.HEXA_RECOVERY_WEBHOOK_TIMEOUT_MS ?? 8_000),
    });
  }
  throw new Error(`Unsupported HEXA_RECOVERY_PROVIDER mode: ${mode}`);
}
