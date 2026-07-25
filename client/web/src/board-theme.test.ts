import { describe, expect, it } from "vitest";

import {
  BOARD_THEMES,
  applyBoardTheme,
  boardThemeForMission,
  boardThemeFromSelectedMission,
  boardThemeFromUrl,
  isBoardThemeId,
} from "./board-theme";

describe("board themes", () => {
  it("maps campaign chapters to their regional boards", () => {
    expect(boardThemeForMission("bridge-of-ashes", "living-prologue", "campaign")).toBe("orun-mill");
    expect(boardThemeForMission("c1-m3", "chapter-1", "campaign")).toBe("orun-mill");
    expect(boardThemeForMission("c2-m2", "chapter-2", "campaign")).toBe("prismatic-ruins");
    expect(boardThemeForMission("c3-m4", "chapter-3", "campaign")).toBe("ash-fortress");
    expect(boardThemeForMission(null, null, "multiplayer")).toBe("ash-fortress");
  });

  it("honors explicit QA and shareable URL overrides", () => {
    expect(boardThemeFromUrl(new URL("https://example.test/?board-theme=prismatic-ruins"))).toBe("prismatic-ruins");
    expect(boardThemeFromUrl(new URL("https://example.test/?qa=1&screen=ui13-ash-combat"))).toBe("ash-fortress");
    expect(boardThemeFromUrl(new URL("https://example.test/?qa=1&screen=ui13-orun-combat"))).toBe("orun-mill");
    expect(boardThemeFromUrl(new URL("https://example.test/"))).toBeNull();
  });

  it("derives the active campaign theme from session storage", () => {
    const storage = { getItem: () => "c2-m1" };
    expect(boardThemeFromSelectedMission(storage)).toBe("prismatic-ruins");
  });

  it("applies semantic theme metadata without touching board geometry", () => {
    const element = document.createElement("section");
    applyBoardTheme(element, "ash-fortress");
    expect(element.dataset.boardTheme).toBe("ash-fortress");
    expect(element.dataset.boardRegion).toBe(BOARD_THEMES["ash-fortress"].region);
    expect(element.getAttribute("data-board-theme-label")).toBe("Fortaleza de Cinzas");
    expect(element.style.left).toBe("");
    expect(element.style.top).toBe("");
  });

  it("accepts only known theme identifiers", () => {
    expect(isBoardThemeId("orun-mill")).toBe(true);
    expect(isBoardThemeId("prismatic-ruins")).toBe(true);
    expect(isBoardThemeId("ash-fortress")).toBe(true);
    expect(isBoardThemeId("unknown")).toBe(false);
  });
});
