import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL(".", import.meta.url));
const css = readFileSync(`${root}/meta10-gameplay-clarity.css`, "utf8");
const campaign = readFileSync(`${root}/CampaignExperience.tsx`, "utf8");
const slice = readFileSync(`${root}/StrategicBoardSlice.tsx`, "utf8");

describe("META 10 gameplay clarity contract", () => {
  it("loads the clarity layer after the strategic authority stylesheet", () => {
    const authority = campaign.indexOf('import "./strategic-board-mode-authority.css"');
    const clarity = campaign.indexOf('import "./meta10-gameplay-clarity.css"');
    expect(authority).toBeGreaterThanOrEqual(0);
    expect(clarity).toBeGreaterThan(authority);
  });

  it("gives origin, recommended route, destination and build cell distinct visual states", () => {
    expect(css).toContain(".strategic-node.is-origin::after");
    expect(css).toContain(".strategic-edge.is-recommended");
    expect(css).toContain(".strategic-node.is-recommended::before");
    expect(css).toContain(".strategic-cell.is-build-target");
    expect(css).toContain("CLIQUE AQUI");
    expect(css).toContain("ORIGEM");
  });

  it("keeps direct board interaction wired to the same semantic states", () => {
    expect(slice).toContain('roadTarget ? "is-road-target"');
    expect(slice).toContain('moveRoute ? "is-move-route"');
    expect(slice).toContain('recommended ? "is-recommended"');
    expect(slice).toContain('onClick={() => selectUnit(unit.id)}');
    expect(slice).toContain('onClick={() => clickCell(cell.id)}');
  });
});
