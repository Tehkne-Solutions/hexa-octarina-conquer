import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authority = readFileSync(
  new URL("./strategic-world-foundation.css", import.meta.url),
  "utf8",
);

describe("META 09.2 physical road construction", () => {
  it("keeps the accepted META 09.1 world contract", () => {
    expect(authority).toContain("clip-path: polygon(50% 0, 98.5% 49.5%, 50% 100%, 1.5% 49.5%)");
    expect(authority).toContain("meta09-water-drift");
    expect(authority).toContain("meta09-unit-breathe");
    expect(authority).toContain("height: 58px !important");
    expect(authority).toContain("opacity: .035 !important");
  });

  it("builds roads through foundation masonry and completion phases", () => {
    expect(authority).toContain("meta09-road-foundation");
    expect(authority).toContain("meta09-road-bed");
    expect(authority).toContain("meta09-road-masonry");
    expect(authority).toContain("meta09-road-dust");
    expect(authority).toContain("meta09-road-complete");
    expect(authority).toContain("transform-origin: 0 50%");
  });

  it("animates visual children instead of moving the interactive edge", () => {
    expect(authority).not.toMatch(/\.strategic-edge\.state-road\s*\{[^}]*animation:/s);
    expect(authority).toContain(".strategic-edge.state-road .strategic-road-shadow");
    expect(authority).toContain(".strategic-edge.state-road .strategic-edge-asset");
  });

  it("respects reduced motion and the Tehkné signature", () => {
    expect(authority).toContain("@media (prefers-reduced-motion: reduce)");
    expect(authority).toContain("animation: none !important");
    expect(authority).toContain("Tehkné Solutions");
  });
});
