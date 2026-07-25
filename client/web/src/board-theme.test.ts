import { describe, expect, it } from "vitest";

import {
  BOARD_THEMES,
  applyBoardTheme,
  boardThemeForMission,
  boardThemeFromSelectedMission,
  boardThemeFromUrl,
  isBoardThemeId,
} from "./board-theme";

function fakeElement(): HTMLElement & { attributes: Map<string, string>; properties: Map<string, string> } {
  const attributes = new Map<string, string>();
  const properties = new Map<string, string>();
  return {
    dataset: {},
    attributes,
    properties,
    style: {
      getPropertyValue: (key: string) => properties.get(key) ?? "",
      setProperty: (key: string, value: string) => { properties.set(key, value); },
    },
    getAttribute: (key: string) => attributes.get(key) ?? null,
    setAttribute: (key: string, value: string) => { attributes.set(key, value); },
  } as unknown as HTMLElement & { attributes: Map<string, string>; properties: Map<string, string> };
}

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
    const element = fakeElement();
    applyBoardTheme(element, "ash-fortress");
    expect(element.dataset.boardTheme).toBe("ash-fortress");
    expect(element.dataset.boardRegion).toBe(BOARD_THEMES["ash-fortress"].region);
    expect(element.getAttribute("data-board-theme-label")).toBe("Fortaleza de Cinzas");
    expect(element.properties.has("left")).toBe(false);
    expect(element.properties.has("top")).toBe(false);
  });

  it("accepts only known theme identifiers", () => {
    expect(isBoardThemeId("orun-mill")).toBe(true);
    expect(isBoardThemeId("prismatic-ruins")).toBe(true);
    expect(isBoardThemeId("ash-fortress")).toBe(true);
    expect(isBoardThemeId("unknown")).toBe(false);
  });
});
