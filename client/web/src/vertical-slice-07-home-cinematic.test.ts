import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeCss = readFileSync(new URL("./vertical-slice-07-home-cinematic.css", import.meta.url), "utf8");
const polishCss = readFileSync(new URL("./vertical-slice-03-polish.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 07 cinematic home contract", () => {
  it("keeps the cinematic home layer loaded by the final polish stylesheet", () => {
    expect(polishCss).toContain('@import "./vertical-slice-07-home-cinematic.css";');
  });

  it("keeps the PACK 99 hero figures at scene scale", () => {
    expect(homeCss).toContain(".hero-figure.hero-kael");
    expect(homeCss).toContain("width: 155px");
    expect(homeCss).toContain("height: 245px");
    expect(homeCss).toContain(".hero-figure.hero-lyra");
    expect(homeCss).toContain("width: 132px");
    expect(homeCss).toContain("height: 218px");
  });

  it("reduces the empty chronicle column instead of stretching it to the hero height", () => {
    expect(homeCss).toContain(".home-chronicle");
    expect(homeCss).toContain("height: fit-content");
    expect(homeCss).toContain("align-self: start");
  });
});
