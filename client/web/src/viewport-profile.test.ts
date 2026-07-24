import { describe, expect, it } from "vitest";

import { classifyViewport } from "./viewport-profile";

describe("classifyViewport", () => {
  it("recognizes a compact notebook viewport", () => {
    expect(classifyViewport(1366, 768)).toEqual({
      widthClass: "notebook",
      heightClass: "compact",
      orientation: "landscape",
      reducedViewport: true,
    });
  });

  it("recognizes a portrait mobile viewport", () => {
    expect(classifyViewport(390, 844)).toEqual({
      widthClass: "mobile",
      heightClass: "standard",
      orientation: "portrait",
      reducedViewport: true,
    });
  });

  it("keeps large desktop screens spacious", () => {
    expect(classifyViewport(1920, 1080)).toEqual({
      widthClass: "desktop",
      heightClass: "standard",
      orientation: "landscape",
      reducedViewport: false,
    });
  });
});
