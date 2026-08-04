import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../public/strategic-battle-vs55.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/strategic-battle-vs55.css", import.meta.url), "utf8");

describe("VS55 enemy intent surface", () => {
  it("loads the passive intent layer after the existing strategic runtime", () => {
    expect(index).toContain('/strategic-battle-vs55.css');
    expect(index).toContain('/strategic-battle-vs55.js');
    expect(index.indexOf('/strategic-battle-vs55.js')).toBeGreaterThan(index.indexOf('/strategic-battle-vs47.js'));
  });

  it("derives player-facing intent only from rendered turn messages", () => {
    expect(runtime).toContain('.strategic-objectives ol li');
    expect(runtime).toContain('data-enemy-intent');
    expect(runtime).not.toContain('debugTrace');
    expect(runtime).not.toMatch(/score\s*\d/i);
  });

  it("targets only Rubra unit tokens with a compact non-interactive badge", () => {
    expect(runtime).toContain('.strategic-unit.unit-varg');
    expect(runtime).toContain('.strategic-unit.unit-brakk');
    expect(styles).toContain('.strategic-unit.owner-red.has-enemy-intent::after');
    expect(styles).toContain('pointer-events: none');
  });
});
