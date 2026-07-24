import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXED_TACTIC_IDS,
  STARTER_HAND,
  buildPlayerHand,
} from "../src/cards.js";
import { parseClientMessage } from "../src/protocol.js";
import { RoomManager } from "../src/room-manager.js";

const VALID_LOADOUT = [
  "kael-golpe-runico",
  "kael-golpe-runico",
  "kael-guardiao-celeste",
  "lyra-flecha-eter",
  "lyra-flecha-eter",
];

function deterministicIds() {
  let value = 0;
  return () => `loadout-id-${++value}`;
}

test("builds an authoritative hand from fixed tactics and the selected loadout", () => {
  assert.deepEqual(buildPlayerHand(VALID_LOADOUT), [...FIXED_TACTIC_IDS, ...VALID_LOADOUT]);
  assert.deepEqual(buildPlayerHand(), [...STARTER_HAND]);
});

test("rejects invalid card copies, role balance and energy", () => {
  assert.throws(() => buildPlayerHand([
    "kael-golpe-runico",
    "kael-golpe-runico",
    "kael-golpe-runico",
    "lyra-flecha-eter",
    "lyra-flecha-eter",
  ]), { code: "INVALID_LOADOUT_COPIES" });

  assert.throws(() => buildPlayerHand([
    "kael-golpe-runico",
    "kael-guardiao-celeste",
    "kael-contra-selo",
    "kael-muralha-astral",
    "lyra-flecha-eter",
  ]), { code: "INVALID_LOADOUT_ROLES" });

  assert.throws(() => buildPlayerHand([
    "kael-contra-selo",
    "kael-muralha-astral",
    "lyra-marca-cacada",
    "lyra-chuva-prismatica",
    "lyra-chuva-prismatica",
  ]), { code: "INVALID_LOADOUT_COST" });
});

test("preserves the selected loadout through protocol parsing", () => {
  const parsed = parseClientMessage(JSON.stringify({
    protocolVersion: "1.0",
    type: "room.create",
    requestId: "loadout-request",
    payload: {
      playerName: "Kael",
      boardSize: 5,
      loadout: VALID_LOADOUT,
    },
  }));
  assert.deepEqual(parsed.payload.loadout, VALID_LOADOUT);
});

test("applies different private hands to multiplayer players", () => {
  const manager = new RoomManager({ idFactory: deterministicIds(), clock: () => 1000 });
  const first = manager.createRoom({ playerName: "Kael", boardSize: 5, loadout: VALID_LOADOUT });
  const secondLoadout = [
    "kael-golpe-runico",
    "kael-guardiao-celeste",
    "lyra-flecha-eter",
    "lyra-flecha-eter",
    "lyra-passo-lunar",
  ];
  const second = manager.joinRoom({ roomId: first.room.id, playerName: "Lyra", loadout: secondLoadout });

  assert.deepEqual(first.player.hand, [...FIXED_TACTIC_IDS, ...VALID_LOADOUT]);
  assert.deepEqual(second.player.hand, [...FIXED_TACTIC_IDS, ...secondLoadout]);
  assert.equal(first.room.snapshot().players[0].handSize, 8);
  assert.equal(first.room.snapshot().players[1].handSize, 8);
});

test("uses the selected hand for the human campaign player and keeps the bot compatible", () => {
  const manager = new RoomManager({ idFactory: deterministicIds(), clock: () => 1000 });
  const result = manager.createCampaignRoom({ missionId: "c1-m1", playerName: "Arquiteto", loadout: VALID_LOADOUT });
  const bot = result.room.players.find((player) => player.isBot);

  assert.deepEqual(result.player.hand, [...FIXED_TACTIC_IDS, ...VALID_LOADOUT]);
  assert.deepEqual(bot.hand, [...STARTER_HAND]);
});

test("validates a loadout before mutating a room", () => {
  const manager = new RoomManager({ idFactory: deterministicIds(), clock: () => 1000 });
  assert.throws(() => manager.createRoom({
    roomId: "SAFELOAD",
    playerName: "A",
    boardSize: 5,
    loadout: ["kael-golpe-runico"],
  }), { code: "INVALID_LOADOUT" });
  assert.equal(manager.rooms.has("SAFELOAD"), false);

  const created = manager.createRoom({ playerName: "A", boardSize: 5, loadout: VALID_LOADOUT });
  assert.throws(() => manager.joinRoom({
    roomId: created.room.id,
    playerName: "B",
    loadout: ["kael-golpe-runico"],
  }), { code: "INVALID_LOADOUT" });
  assert.equal(created.room.players.length, 1);
});
