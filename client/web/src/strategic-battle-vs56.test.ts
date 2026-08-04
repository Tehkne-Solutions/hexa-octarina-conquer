import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../public/strategic-battle-vs56.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/strategic-battle-vs56.css", import.meta.url), "utf8");

describe("VS56 combat opportunity readability", () => {
  it("loads after the VS55 intent surface", () => {
    expect(index).toContain('/strategic-battle-vs56.css');
    expect(index).toContain('/strategic-battle-vs56.js');
    expect(index.indexOf('/strategic-battle-vs56.js')).toBeGreaterThan(index.indexOf('/strategic-battle-vs55.js'));
  });

  it("derives damage only from selected Orun units and legal attack targets", () => {
    expect(runtime).toContain('Kael: 6');
    expect(runtime).toContain('Lyra: 5');
    expect(runtime).toContain('.strategic-unit.owner-blue.is-selected b');
    expect(runtime).toContain('.strategic-unit.owner-red.is-attack-target');
    expect(runtime).toMatch(/LETAL · -\$\{attacker\.damage\} HP/);
    expect(runtime).toMatch(/DANO · -\$\{attacker\.damage\} HP/);
  });

  it("stays presentation-only", () => {
    expect(runtime).not.toContain('debugTrace');
    expect(runtime).not.toMatch(/score\s*\d/i);
    expect(runtime).not.toContain('dispatchEvent');
    expect(runtime).not.toContain('.click(');
    expect(styles).toContain('pointer-events: none');
  });
});
