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

test("parses account registration and account-linked room creation", () => {
  const registration = parseClientMessage(JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    type: "account.register",
    payload: { handle: "arquiteto", displayName: "Arquiteto", password: "senha-segura" },
  }));
  assert.equal(registration.payload.handle, "arquiteto");

  const room = parseClientMessage(JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    type: "room.create",
    payload: { accountId: "account-1", accessToken: "secret" },
  }));
  assert.equal(room.payload.accountId, "account-1");
  assert.equal(room.payload.playerName, undefined);
});

test("rejects partial account credentials on room commands", () => {
  assert.throws(() => parseClientMessage(JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    type: "room.join",
    payload: { roomId: "ROOM", accountId: "account-1" },
  })), (error) => error instanceof ProtocolError && error.code === "INVALID_MESSAGE");
});

test("parses leaderboard and match forfeit commands", () => {
  const leaderboard = parseClientMessage(JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    type: "leaderboard.list",
    payload: { limit: 10 },
  }));
  assert.equal(leaderboard.payload.limit, 10);

  const forfeit = parseClientMessage(JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    type: "match.forfeit",
    payload: {
      roomId: "ROOM",
      playerId: "P1",
      sessionToken: "TOKEN",
      expectedRevision: 4,
    },
  }));
  assert.equal(forfeit.payload.expectedRevision, 4);
});

test("parses a lobby request without requiring a payload", () => {
  const command = parseClientMessage(JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    type: "lobby.list",
    requestId: "lobby-1",
  }));
  assert.equal(command.type, "lobby.list");
  assert.equal(command.payload.status, undefined);
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
