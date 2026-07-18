import assert from "node:assert/strict";
import test from "node:test";

import { BoardState } from "../src/board-state.js";
import { GameRoom } from "../src/game-room.js";

function closeCell(board, ownerId, x, y) {
  const ownerIndex = board.playerOrder.indexOf(ownerId);
  board.currentPlayerIndex = ownerIndex;
  const edges = [
    [[x, y], [x + 1, y]],
    [[x, y], [x, y + 1]],
    [[x + 1, y], [x + 1, y + 1]],
    [[x, y + 1], [x + 1, y + 1]],
  ];
  for (const [start, end] of edges) {
    const key = `${start.join(",")}|${end.join(",")}`;
    const reverse = `${end.join(",")}|${start.join(",")}`;
    if (![...board.edges.keys()].includes(key) && ![...board.edges.keys()].includes(reverse)) {
      board.playEdge(ownerId, start, end, { consumeAction: false });
    }
  }
}

test("connected cells merge into one persistent province", () => {
  const board = new BoardState(3);
  board.setPlayerOrder(["A", "B"]);
  closeCell(board, "A", 0, 0);
  const first = [...board.provinces.values()][0];
  first.unit = { kind: "fortress", level: 3, hp: 11, element: "physical" };

  closeCell(board, "A", 1, 0);

  assert.equal(board.provinces.size, 1);
  const province = [...board.provinces.values()][0];
  assert.deepEqual(province.cellIds, ["cell:0,0", "cell:1,0"]);
  assert.equal(province.unit.kind, "fortress");
  assert.equal(province.unit.level, 3);
  assert.equal(province.unit.hp, 11);
  assert.equal(board.cells.get("1,0").provinceId, province.id);
});

test("one edge closing two cells grants two bonus actions", () => {
  const board = new BoardState(3);
  board.setPlayerOrder(["A", "B"]);
  const setupEdges = [
    [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 1], [1, 1]],
    [[1, 0], [2, 0]], [[2, 0], [2, 1]], [[1, 1], [2, 1]],
  ];
  for (const [start, end] of setupEdges) board.playEdge("A", start, end, { consumeAction: false });
  board.actionsRemaining = 1;

  const result = board.playEdge("A", [1, 0], [1, 1]);

  assert.deepEqual(result.claimedCellIds, ["cell:0,0", "cell:1,0"]);
  assert.equal(board.actionsRemaining, 2);
  assert.equal(board.currentPlayerId, "A");
});

test("captured territory merges with adjacent allied province", () => {
  const board = new BoardState(3);
  board.setPlayerOrder(["A", "B"]);
  const left = board.claimCell([0, 0], "A");
  const right = board.claimCell([1, 0], "B");

  const merged = board.captureProvince(right.id, "A", 5);

  assert.equal(board.provinces.size, 1);
  assert.equal(merged.id, right.id);
  assert.deepEqual(merged.cellIds, ["cell:0,0", "cell:1,0"]);
  assert.equal(board.cells.get("0,0").ownerId, "A");
  assert.equal(board.cells.get("1,0").ownerId, "A");
  assert.equal(left.ownerId, "A");
});

test("legacy cell snapshots migrate into connected provinces", () => {
  const board = BoardState.fromJSON({
    boardSize: 3,
    playerOrder: ["A", "B"],
    currentPlayerIndex: 0,
    turnNumber: 4,
    actionsRemaining: 1,
    edges: [],
    cells: [
      { id: "cell:0,0", x: 0, y: 0, ownerId: "A", unit: { kind: "fortress", level: 2, hp: 8 } },
      { id: "cell:1,0", x: 1, y: 0, ownerId: "A", unit: { kind: "recruit", level: 1, hp: 3 } },
    ],
  });

  assert.equal(board.provinces.size, 1);
  const province = [...board.provinces.values()][0];
  assert.deepEqual(province.cellIds, ["cell:0,0", "cell:1,0"]);
  assert.equal(province.unit.kind, "fortress");
  assert.equal(province.unit.hp, 8);
});

test("surrounded province opens one automatic duel", () => {
  const ids = ["PLAYER-A", "TOKEN-A", "PLAYER-B", "TOKEN-B"];
  const room = new GameRoom({ id: "ROOM", boardSize: 3, idFactory: () => ids.shift() ?? crypto.randomUUID() });
  const first = room.addPlayer("A").player;
  const second = room.addPlayer("B").player;
  room.board.claimCell([0, 0], first.id);
  room.board.claimCell([1, 0], second.id);
  room.board.claimCell([0, 1], second.id);
  room.board.claimCell([1, 1], second.id);

  const opened = room.openAutomaticSieges();
  const repeated = room.openAutomaticSieges();

  assert.equal(opened.length, 1);
  assert.equal(repeated.length, 0);
  const duel = room.duels.get(opened[0]);
  assert.equal(duel.reason, "surround");
  assert.equal(duel.attackerId, second.id);
  assert.equal(duel.defenderId, first.id);
});
