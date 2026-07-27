import { describe, expect, it } from "vitest";

import {
  inspectPack99RuntimeIndex,
  pack99PublicUrl,
  type Pack99RuntimeAsset,
  type Pack99RuntimeIndex,
} from "./pack99-runtime";

function asset(index: number): Pack99RuntimeAsset {
  return {
    id: `PACK99_ASSET_${String(index).padStart(4, "0")}`,
    category: "test",
    web: `client/web/public/assets/runtime/pack99/test/asset-${index}.png`,
  };
}

describe("PACK 99 runtime gate", () => {
  it("classifica o índice versionado de 33 assets como bootstrap", () => {
    const index: Pack99RuntimeIndex = {
      profile: "bootstrap",
      assetCount: 33,
      assets: Array.from({ length: 33 }, (_, index) => asset(index)),
    };

    expect(inspectPack99RuntimeIndex(index)).toEqual({
      mode: "bootstrap",
      reportedAssetCount: 33,
      materializedAssetCount: 33,
      isFullRuntime: false,
      usesFallbacks: true,
    });
  });

  it("não aceita uma declaração full sem 1.037 entradas materializadas", () => {
    const index: Pack99RuntimeIndex = {
      profile: "full",
      assetCount: 1037,
      assets: [asset(1)],
    };

    expect(inspectPack99RuntimeIndex(index)).toMatchObject({
      mode: "full",
      isFullRuntime: false,
      usesFallbacks: true,
    });
  });

  it("libera o runtime integral somente com 1.037 entradas reais", () => {
    const assets = Array.from({ length: 1037 }, (_, index) => asset(index));
    const index: Pack99RuntimeIndex = {
      profile: "full",
      assetCount: assets.length,
      assets,
    };

    expect(inspectPack99RuntimeIndex(index)).toMatchObject({
      mode: "full",
      reportedAssetCount: 1037,
      materializedAssetCount: 1037,
      isFullRuntime: true,
      usesFallbacks: false,
    });
  });

  it("resolve a URL pública mesmo quando o índice full não possui sourcePath", () => {
    expect(pack99PublicUrl(asset(9))).toBe("/assets/runtime/pack99/test/asset-9.png");
  });
});
