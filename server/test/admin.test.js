import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { MemoryIdentityStore } from "../src/identity-memory.js";
import { startServer } from "../src/server.js";

test("admin API protects and manages seasons and penalties", async () => {
  const previousToken = process.env.HEXA_ADMIN_TOKEN;
  process.env.HEXA_ADMIN_TOKEN = "admin-secret";
  const identity = new MemoryIdentityStore();
  const account = await identity.register({ handle: "admin_target", displayName: "Admin Target", password: "password-target" });
  const instance = startServer({ port: 0, identity });

  try {
    await once(instance.httpServer, "listening");
    const address = instance.httpServer.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const unauthorized = await fetch(`${baseUrl}/admin/seasons`);
    assert.equal(unauthorized.status, 401);

    const headers = { authorization: "Bearer admin-secret", "content-type": "application/json" };
    const startsAt = Date.now() + 60_000;
    const createdResponse = await fetch(`${baseUrl}/admin/seasons`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "create",
        id: "season-admin-test",
        name: "Temporada Administrada",
        startsAt,
        endsAt: startsAt + 30 * 24 * 60 * 60 * 1000,
      }),
    });
    assert.equal(createdResponse.status, 200);
    assert.equal((await createdResponse.json()).season.status, "planned");

    const activated = await fetch(`${baseUrl}/admin/seasons`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "activate", seasonId: "season-admin-test" }),
    });
    assert.equal((await activated.json()).season.status, "active");

    const penaltyResponse = await fetch(`${baseUrl}/admin/penalties`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        accountId: account.account.id,
        kind: "moderation",
        durationMs: 120_000,
        reason: "automated test",
      }),
    });
    const penalty = (await penaltyResponse.json()).penalty;
    assert.equal(penalty.accountId, account.account.id);

    const listed = await fetch(`${baseUrl}/admin/penalties?accountId=${encodeURIComponent(account.account.id)}`, { headers });
    assert.equal((await listed.json()).penalties.length, 1);

    const cleared = await fetch(`${baseUrl}/admin/penalties`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "clear", accountId: account.account.id }),
    });
    assert.equal((await cleared.json()).removed, 1);
  } finally {
    await instance.close();
    if (previousToken === undefined) delete process.env.HEXA_ADMIN_TOKEN;
    else process.env.HEXA_ADMIN_TOKEN = previousToken;
  }
});
