import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicAttack,
  strategicUnit,
} from "./strategic-board-model";

describe("META 10.15 combat stat symmetry", () => {
  it("starts both factions with the same total HP", () => {
    const board = createStrategicBoard();
    const blueHp = board.units.filter((unit) => unit.faction === "blue").reduce((sum, unit) => sum + unit.maxHp, 0);
    const redHp = board.units.filter((unit) => unit.faction === "red").reduce((sum, unit) => sum + unit.maxHp, 0);

    expect(blueHp).toBe(32);
    expect(redHp).toBe(32);
  });

  it("pairs Brakk with Kael and Varg with Lyra for base damage", () => {
    let kaelBoard = createStrategicBoard();
    kaelBoard = {
      ...kaelBoard,
      units: kaelBoard.units.map((unit) => unit.id === "brakk" ? { ...unit, nodeId: "s-0-1" } : unit),
    };
    const brakkBefore = strategicUnit(kaelBoard, "brakk").hp;
    const afterKael = strategicAttack(kaelBoard, "kael", "brakk");
    expect(brakkBefore - strategicUnit(afterKael, "brakk").hp).toBe(6);

    let brakkBoard = createStrategicBoard();
    brakkBoard = {
      ...brakkBoard,
      units: brakkBoard.units.map((unit) => unit.id === "brakk" ? { ...unit, nodeId: "s-0-1" } : unit),
    };
    const kaelBefore = strategicUnit(brakkBoard, "kael").hp;
    const afterBrakk = strategicAttack(brakkBoard, "brakk", "kael");
    expect(kaelBefore - strategicUnit(afterBrakk, "kael").hp).toBe(6);

    let vargBoard = createStrategicBoard();
    vargBoard = {
      ...vargBoard,
      units: vargBoard.units.map((unit) => unit.id === "varg" ? { ...unit, nodeId: "s-0-1" } : unit),
    };
    const lyraBefore = strategicUnit(vargBoard, "lyra").hp;
    const afterVarg = strategicAttack(vargBoard, "varg", "lyra");
    expect(lyraBefore - strategicUnit(afterVarg, "lyra").hp).toBe(5);
  });
});
