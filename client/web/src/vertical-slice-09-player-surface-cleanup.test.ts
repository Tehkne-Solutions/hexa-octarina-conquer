import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cleanup = readFileSync(new URL("./Pack99PlayerSurfaceCleanup.tsx", import.meta.url), "utf8");
const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const polishCss = readFileSync(new URL("./vertical-slice-03-polish.css", import.meta.url), "utf8");
const surfaceCss = readFileSync(new URL("./vertical-slice-09-player-surface-cleanup.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 09 player surface cleanup", () => {
  it("mounts the cleanup in the production enhancement tree", () => {
    expect(runtimeEnhancements).toContain('import { Pack99PlayerSurfaceCleanup }');
    expect(runtimeEnhancements).toContain("<Pack99PlayerSurfaceCleanup />");
  });

  it("matches the actual BUILD + PACK 99 diagnostic text instead of relying on a guessed class", () => {
    expect(cleanup).toContain("TECHNICAL_BADGE_PATTERN");
    expect(cleanup).toContain("PACK\\s*99");
    expect(cleanup).toContain("1037");
    expect(cleanup).toContain('dataset.playerSurfaceHidden = "pack99-build"');
  });

  it("preserves QA and dev diagnostics", () => {
    expect(cleanup).toContain("import.meta.env.DEV");
    expect(cleanup).toContain('params.get("qa") === "1"');
  });

  it("loads the final surface layer and tightens the canonical hero crop", () => {
    expect(polishCss).toContain('@import "./vertical-slice-09-player-surface-cleanup.css";');
    expect(surfaceCss).toContain("background-size: 226% auto !important");
    expect(surfaceCss).toContain("background-size: 232% auto !important");
  });
});
