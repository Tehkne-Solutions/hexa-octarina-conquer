import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { BoardState } from "../src/board-state.js";

const scenarios = JSON.parse(readFileSync(new URL("../../conformance/scenarios.json", import.meta.url), "utf8"));
const pythonRunner = new URL("../../conformance/python_runner.py", import.meta.url);

function normalizeNode(board) {
  const cells = [...board.cells.values()]
    .map((cell) => ({ x: cell.x, y: cell.y, owner: cell.ownerId }))
    .sort((left, right) => left.x - right.x || left.y - right.y || left.owner.localeCompare(right.owner));
  const provinces = [...board.provinces.values()]
    .map((province) => ({
      owner: province.ownerId,
      cells: province.cellIds
        .map((cellId) => cellId.slice(5).split(",").map(Number))
        .sort((left, right) => left[0] - right[0] || left[1] - right[1]),
      unit: {
        kind: province.unit.kind,
        level: province.unit.level,
        hp: province.unit.hp,
      },
    }))
    .sort((left, right) => left.owner.localeCompare(right.owner) || JSON.stringify(left.cells).localeCompare(JSON.stringify(right.cells)));
  return { cells, provinces };
}

function runNode(scenario) {
  const board = new BoardState(scenario.size);
  board.setPlayerOrder(scenario.players);
  for (const operation of scenario.operations) {
    board.currentPlayerIndex = scenario.players.indexOf(operation.actor);
    board.playEdge(operation.actor, operation.start, operation.end, { consumeAction: false });
  }
  return normalizeNode(board);
}

function runPython(scenario) {
  const executable = process.env.PYTHON ?? "python";
  const result = spawnSync(executable, [pythonRunner.pathname], {
    input: JSON.stringify(scenario),
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Python conformance runner failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

for (const scenario of scenarios) {
  test(`Python and Node remain conformant: ${scenario.name}`, () => {
    assert.deepEqual(runNode(scenario), runPython(scenario));
  });
}
