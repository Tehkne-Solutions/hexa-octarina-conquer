import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/campaign-vs64.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/campaign-vs64.css", import.meta.url), "utf8");

describe("VS64 mission variety and objective identity", () => {
  it("loads the campaign identity surface", () => {
    expect(html).toContain("campaign-vs64.css");
    expect(html).toContain("campaign-vs64.js");
  });

  it("derives profiles from already rendered authoritative objectives", () => {
    expect(js).toContain(".briefing-objectives article");
    expect(js).toContain("FORTIFICAÇÃO");
    expect(js).toContain("PRESSÃO");
    expect(js).toContain("RITMO");
    expect(js).toContain("RESISTÊNCIA");
    expect(js).toContain("CONQUISTA");
  });

  it("is presentation-only and does not synthesize campaign rules", () => {
    expect(js).not.toContain("fetch(");
    expect(js).not.toContain("dispatchEvent");
    expect(js).not.toContain(".click(");
    expect(js).not.toContain("debugTrace");
    expect(css).toContain("campaign-mission-identity");
  });
});
