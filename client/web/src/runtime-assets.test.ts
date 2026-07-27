import { describe, expect, it } from "vitest";

import { runtimeFallbackAllowed, runtimePackRequired, runtimePackStatus } from "./runtime-assets";

describe("PACK 99 production policy", () => {
  it("never enables a procedural fallback without the explicit development flag", () => {
    expect(runtimePackRequired()).toBe(!runtimeFallbackAllowed());
  });

  it("starts in a deterministic loading state", () => {
    expect(runtimePackStatus()).toMatchObject({
      state: "loading",
      required: runtimePackRequired(),
    });
  });
});
