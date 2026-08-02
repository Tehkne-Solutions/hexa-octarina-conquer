import { afterEach, describe, expect, it, vi } from "vitest";

import { resetRuntimeAssetCache, runtimeAssetUrl } from "./runtime-assets";

const KAEL_ID = "HERO_GUARDIAN_01_IDLE_BASE_SW_01";
const KAEL_PATH = "packages/PACK_07_HERO_ROSTER/guardian/directions/HERO_GUARDIAN_01_IDLE_BASE_SW_01.png";

afterEach(() => {
  vi.unstubAllGlobals();
  resetRuntimeAssetCache();
});

describe("PACK 99 canonical alias bootstrap", () => {
  it("resolves player art when the replaced production runtime archive omits its alias registry", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/assets/runtime/registry/assets-runtime.json") {
        return { ok: true, json: async () => ({
          project: "HOC",
          packId: "HOC_PACK_99_FINAL_RUNTIME",
          version: "1.0.1",
          profile: "full",
          assetCount: 0,
          assets: [],
          unresolved: [],
          signature: "Tehkné Solutions",
        }) } as Response;
      }
      if (url === "/assets/runtime/registry/canonical-runtime-aliases.json") {
        return { ok: false } as Response;
      }
      if (url === "/canonical-runtime-aliases.json") {
        return { ok: true, json: async () => ({
          packId: "HOC_PACK_99_FINAL_RUNTIME",
          version: "1.0.1",
          aliases: { [KAEL_ID]: KAEL_PATH },
        }) } as Response;
      }
      return { ok: false } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);
    resetRuntimeAssetCache();

    await expect(runtimeAssetUrl(KAEL_ID)).resolves.toBe(`/assets/runtime/${KAEL_PATH}`);
    expect(fetchMock).toHaveBeenCalledWith("/canonical-runtime-aliases.json", { cache: "no-cache" });
  });
});
