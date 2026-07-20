import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { MemoryCampaignStore } from "../src/campaign-store.js";
import { MemoryIdentityStore } from "../src/identity-memory.js";
import { RoomManager } from "../src/room-manager.js";
import { startServer } from "../src/server-campaign.js";

async function jsonRequest(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const payload = await response.json();
  return { response, payload };
}

test("serves the catalog, starts a solo mission and records authenticated progress", async () => {
  const manager = new RoomManager();
  const identity = new MemoryIdentityStore();
  const campaign = new MemoryCampaignStore({ clock: () => 5000 });
  const session = await identity.register({
    handle: "campaigner",
    displayName: "Campaigner",
    password: "campaign-password",
  });
  const instance = startServer({ port: 0, manager, identity, campaign });

  try {
    await once(instance.httpServer, "listening");
    const address = instance.httpServer.address();
    const base = `http://127.0.0.1:${address.port}`;
    const authHeaders = {
      "x-account-id": session.account.id,
      authorization: `Bearer ${session.accessToken}`,
    };

    const catalogResponse = await jsonRequest(base, "/campaign/catalog", { headers: authHeaders });
    assert.equal(catalogResponse.response.status, 200);
    assert.equal(catalogResponse.payload.missions.length, 12);
    assert.equal(catalogResponse.payload.missions[0].unlocked, true);
    assert.equal(catalogResponse.payload.missions[4].unlocked, false);

    const startResponse = await jsonRequest(base, "/campaign/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        missionId: "c1-m1",
        accountId: session.account.id,
        accessToken: session.accessToken,
      }),
    });
    assert.equal(startResponse.response.status, 201);
    assert.equal(startResponse.payload.snapshot.mode, "campaign");
    assert.equal(startResponse.payload.snapshot.status, "active");
    assert.equal(startResponse.payload.snapshot.players.length, 2);
    assert.equal(startResponse.payload.snapshot.players[1].isBot, true);

    const room = manager.getRoom(startResponse.payload.roomId);
    const human = room.players.find((player) => !player.isBot);
    room.board.cells.set("0,0", {
      id: "cell:0,0", x: 0, y: 0, ownerId: human.id, provinceId: "province-http",
    });
    room.board.provinces.set("province-http", {
      id: "province-http",
      ownerId: human.id,
      cellIds: ["cell:0,0"],
      unit: { kind: "recruit", level: 1, hp: 3, element: "physical" },
      protectedTurns: 0,
    });
    room.commit("campaign.test_progress", { playerId: human.id });
    manager.persist(room);

    const completeResponse = await jsonRequest(base, "/campaign/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        accountId: session.account.id,
        accessToken: session.accessToken,
      }),
    });
    assert.equal(completeResponse.response.status, 200);
    assert.equal(completeResponse.payload.recorded, true);
    assert.equal(completeResponse.payload.result.success, true);
    assert.equal(completeResponse.payload.catalog.totals.stars, 3);
    assert.equal(completeResponse.payload.catalog.missions[1].unlocked, true);

    const duplicate = await jsonRequest(base, "/campaign/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        accountId: session.account.id,
        accessToken: session.accessToken,
      }),
    });
    assert.equal(duplicate.payload.recorded, false);
  } finally {
    await instance.close();
  }
});
