import assert from "node:assert/strict";
import test from "node:test";

import { RoomManager } from "../src/room-manager.js";

function deterministicIds() {
  let value = 0;
  return () => `id-${++value}`;
}

test("private state exposes only the authenticated player's complete hand", () => {
  const manager = new RoomManager({ idFactory: deterministicIds(), clock: () => 1000 });
  const created = manager.createRoom({ playerName: "A", boardSize: 5 });
  const joined = manager.joinRoom({ roomId: created.room.id, playerName: "B" });

  const firstPrivate = created.room.privateStateFor(created.player.id);
  const secondPrivate = created.room.privateStateFor(joined.player.id);
  const publicSnapshot = created.room.snapshot();

  assert.equal(firstPrivate.playerId, created.player.id);
  assert.equal(firstPrivate.hand.length, 8);
  assert.equal(firstPrivate.hand[0].name, "Expansão Rúnica");
  assert.equal(firstPrivate.hand.every((card) => typeof card.description === "string"), true);
  assert.equal(secondPrivate.playerId, joined.player.id);
  assert.equal(JSON.stringify(publicSnapshot).includes("sessionToken"), false);
  assert.equal(JSON.stringify(publicSnapshot).includes("Raio Encadeado"), false);
});

test("private state tracks only the local duel submission", () => {
  const manager = new RoomManager({ idFactory: deterministicIds(), clock: () => 1000 });
  const first = manager.createRoom({ playerName: "A", boardSize: 3 });
  const second = manager.joinRoom({ roomId: first.room.id, playerName: "B" });
  const room = second.room;
  room.board.claimCell([0, 0], second.player.id);
  const province = [...room.board.provinces.values()][0];
  const duel = room.createDuelForProvince(first.player.id, province.id, "card");

  room.submitDuelRound(first.player, duel.id, ["strike"]);

  assert.deepEqual(room.privateStateFor(first.player.id).duelSubmissions[duel.id], ["strike"]);
  assert.equal(room.privateStateFor(second.player.id).duelSubmissions[duel.id], undefined);
});
