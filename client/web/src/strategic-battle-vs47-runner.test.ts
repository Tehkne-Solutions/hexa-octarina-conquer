import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const index = readFileSync(new URL("index.html", root), "utf8");
const runner = readFileSync(new URL("public/strategic-battle-vs47.js", root), "utf8");

describe("VS47 opt-in mission playtest runner", () => {
  it("is strictly opt-in and disabled for normal players", () => {
    expect(runner).toContain('params.get("hocPlaytest") === "1"');
    expect(runner).toContain('window.__HOC_PLAYTEST__ === true');
    expect(runner).toContain('if (!enabled() || running) return');
  });

  it("uses only controls exposed by the live runtime", () => {
    expect(runner).toContain("[data-legal-target='true']");
    expect(runner).toContain("ENCERRAR TURNO");
    expect(runner).not.toMatch(/fetch\(|dispatchEvent|setState|playCard|resolveDuelRound|pathfind|range\s*=|cost\s*=/i);
  });

  it("waits through enemy phase and stops on a terminal lifecycle state", () => {
    expect(runner).toContain('state === "enemy"');
    expect(runner).toContain('new Set(["victory", "defeat", "resolved"])');
    expect(runner).toContain("MAX_STEPS = 64");
  });

  it("loads after VS46 tracing", () => {
    expect(index.indexOf("strategic-battle-vs46.js")).toBeGreaterThan(-1);
    expect(index.indexOf("strategic-battle-vs47.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs46.js"));
  });
});
