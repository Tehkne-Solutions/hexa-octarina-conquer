import assert from "node:assert/strict";
import test from "node:test";

import { PROTOCOL_VERSION, ProtocolError, parseClientMessage } from "../src/protocol.js";

test("parses a room creation command with a default board size", () => {
  const command = parseClientMessage(JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    type: "room.create",
    requestId: "req-1",
    payload: { playerName: "Octarina" },
  }));

  assert.equal(command.type, "room.create");
  assert.equal(command.payload.boardSize, 5);
});

test("rejects incompatible protocol versions", () => {
  assert.throws(() => parseClientMessage(JSON.stringify({
    protocolVersion: "2.0",
    type: "ping",
  })), (error) => error instanceof ProtocolError && error.code === "UNSUPPORTED_PROTOCOL");
});

test("rejects malformed edge coordinates before room dispatch", () => {
  assert.throws(() => parseClientMessage(JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    type: "action.play_edge",
    payload: {
      roomId: "ROOM",
      playerId: "P1",
      sessionToken: "TOKEN",
      expectedRevision: 0,
      start: [0],
      end: [1, 0],
    },
  })), (error) => error instanceof ProtocolError && error.code === "INVALID_MESSAGE");
});
