import { describe, expect, it } from "vitest";

import {
  campaignMissionGlyph,
  campaignNarrativeTheme,
  campaignThemeStyle,
  visualQaCampaignCatalog,
} from "./campaign-narrative";

describe("campaign narrative themes", () => {
  it("maps every campaign chapter to a distinct lightweight key art", () => {
    const themes = [
      campaignNarrativeTheme("living-prologue"),
      campaignNarrativeTheme("chapter-1"),
      campaignNarrativeTheme("chapter-2"),
      campaignNarrativeTheme("chapter-3"),
    ];

    expect(new Set(themes.map((theme) => theme.id)).size).toBe(4);
    expect(new Set(themes.map((theme) => theme.keyArt)).size).toBe(4);
    for (const theme of themes) {
      expect(theme.keyArt).toMatch(/^\/assets\/chapters\/.+\.svg$/);
      expect(theme.alt.length).toBeGreaterThan(20);
      expect(theme.atmosphere.length).toBeGreaterThan(20);
    }
  });

  it("creates stable mission seals and CSS tokens", () => {
    expect(campaignMissionGlyph("chapter-1", 1)).toBe("Ⅰ");
    expect(campaignMissionGlyph("chapter-2", 6)).toBe("✷");
    expect(campaignMissionGlyph("chapter-3", 11)).toBe("⬡");

    const style = campaignThemeStyle(campaignNarrativeTheme("chapter-2"));
    expect(style["--chapter-accent"]).toBe("#b889dc");
    expect(style["--chapter-shadow"]).toBe("#1c1328");
  });

  it("provides an isolated visual QA catalog for every server chapter", () => {
    const catalog = visualQaCampaignCatalog();
    expect(catalog.chapters.map((chapter) => chapter.id)).toEqual(["chapter-1", "chapter-2", "chapter-3"]);
    expect(catalog.missions).toHaveLength(3);
    expect(catalog.missions.every((mission) => mission.unlocked)).toBe(true);
    expect(catalog.missions.map((mission) => mission.chapterId)).toEqual(["chapter-1", "chapter-2", "chapter-3"]);
  });
});
