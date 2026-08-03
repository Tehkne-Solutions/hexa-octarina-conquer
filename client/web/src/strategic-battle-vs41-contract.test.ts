import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(root, "public", "strategic-battle-vs41.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

describe("VS41 end-turn readiness contract", () => {
  it("loads after VS40", () => {
    expect(html.indexOf("strategic-battle-vs40.js")).toBeLessThan(html.indexOf("strategic-battle-vs41.js"));
  });

  it("derives readiness only from rendered budget", () => {
    expect(js).toContain('.strategic-turn-loop-budget');
    expect(js).toContain('Object.values(values).every((value) => value === 0)');
  });

  it("does not alter gameplay or trigger actions", () => {
    expect(js).not.toContain(".click(");
    expect(js).not.toContain("dispatchEvent");
    expect(js).not.toContain("preventDefault");
    expect(js).not.toContain("disabled =");
    expect(js).not.toContain("fetch(");
  });
});
