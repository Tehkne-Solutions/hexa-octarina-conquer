import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const territory = readFileSync(
  new URL("./strategic-territory-claim.css", import.meta.url),
  "utf8",
);

describe("META 09.3 physical territory claim", () => {
  it("loads the territory authority from the Vite shell", () => {
    expect(html).toContain('/src/strategic-territory-claim.css');
  });

  it("materializes faction control with perimeter, standard and occupation", () => {
    expect(territory).toContain("meta09-territory-fill");
    expect(territory).toContain("meta09-territory-perimeter");
    expect(territory).toContain("meta09-territory-standard");
    expect(territory).toContain("meta09-territory-banner");
    expect(territory).toContain(".strategic-building-slot");
  });

  it("animates only cell decoration and keeps the strategic button stable", () => {
    expect(territory).not.toContain(".strategic-cell {\n  transform:");
    expect(territory).not.toContain("pointer-events: auto");
    expect(territory).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("preserves the Tehkné Solutions signature", () => {
    expect(territory).toContain("Tehkné Solutions");
  });
});
