// @ts-nocheck
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./board-entities.css", import.meta.url), "utf8");
const board = readFileSync(new URL("./Board.tsx", import.meta.url), "utf8");

describe("territorial visuals", () => {
  it("keeps conquered walls visible even when animation support fails", () => {
    expect(css).toContain(".wall-build");
    expect(css).toMatch(/\.wall-build\s*\{[^}]*opacity:\s*1/s);
    expect(css).toMatch(/\.wall-build\s*\{[^}]*visibility:\s*visible/s);
    expect(css).not.toContain("stroke-dashoffset: 1");
  });

  it("renders buildings instead of a textual province marker", () => {
    expect(board).toContain("RuneWall");
    expect(board).toContain("RecruitEntity");
    expect(board).toContain("FortressEntity");
    expect(board).toContain("OutpostEntity");
    expect(board).not.toContain('className="province-label"');
  });
});
