import { describe, expect, it } from "vitest";

import {
  findPack99CanonicalAsset,
  inspectPack99RuntimeIndex,
  pack99PublicUrl,
  PACK99_FULL_MIN_MATERIALIZED_COUNT,
  type Pack99RuntimeAsset,
  type Pack99RuntimeIndex,
} from "./pack99-runtime";

function bootstrapAsset(index: number): Pack99RuntimeAsset {
  return {
    id: `PACK99_ASSET_${String(index).padStart(4, "0")}`,
    category: "test",
    web: `client/web/public/assets/runtime/pack99/test/asset-${index}.png`,
  };
}

function fullIndex(): Pack99RuntimeIndex {
  const canonicalAssets = Array.from({ length: 1037 }, (_, index): Pack99RuntimeAsset => {
    const canonicalId = `PACK99_CANONICAL_${String(index).padStart(4, "0")}`;
    return {
      id: canonicalId,
      canonicalId,
      category: "test",
      layer: "base",
      sourcePath: `packages/PACK_TEST/${canonicalId}.png`,
      web: `client/web/public/assets/runtime/packages/PACK_TEST/${canonicalId}.png`,
      bytes: 128,
    };
  });
  const extraLayers = Array.from(
    { length: PACK99_FULL_MIN_MATERIALIZED_COUNT - canonicalAssets.length },
    (_, index): Pack99RuntimeAsset => {
      const canonicalId = canonicalAssets[index].canonicalId!;
      return {
        id: `${canonicalId}__SHADOW`,
        canonicalId,
        category: "test-shadow",
        layer: "shadow",
        sourcePath: `packages/PACK_TEST/${canonicalId}_SHADOW.png`,
        web: `client/web/public/assets/runtime/packages/PACK_TEST/${canonicalId}_SHADOW.png`,
        bytes: 64,
      };
    },
  );
  return {
    profile: "full",
    runtimeMode: "full",
    assetCount: 1037,
    canonicalAssetCount: 1037,
    materializedAssetCount: PACK99_FULL_MIN_MATERIALIZED_COUNT,
    fallback: null,
    assets: [...canonicalAssets, ...extraLayers],
    signature: "Tehkné Solutions",
  };
}

describe("PACK 99 runtime gate", () => {
  it("classifica o índice versionado de 33 assets como bootstrap", () => {
    const index: Pack99RuntimeIndex = {
      profile: "bootstrap",
      assetCount: 33,
      fallback: "procedural",
      assets: Array.from({ length: 33 }, (_, index) => bootstrapAsset(index)),
    };

    expect(inspectPack99RuntimeIndex(index)).toEqual({
      mode: "bootstrap",
      reportedAssetCount: 33,
      canonicalAssetCount: 33,
      materializedAssetCount: 33,
      isFullRuntime: false,
      usesFallbacks: true,
    });
  });

  it("não aceita uma declaração full sem 1.850 entradas materializadas", () => {
    const index: Pack99RuntimeIndex = {
      profile: "full",
      runtimeMode: "full",
      assetCount: 1037,
      canonicalAssetCount: 1037,
      fallback: null,
      assets: [bootstrapAsset(1)],
    };

    expect(inspectPack99RuntimeIndex(index)).toMatchObject({
      mode: "bootstrap",
      isFullRuntime: false,
      usesFallbacks: true,
    });
  });

  it("rejeita um índice materializado que ainda anuncia fallback", () => {
    const index = fullIndex();
    index.fallback = "procedural";

    expect(inspectPack99RuntimeIndex(index)).toMatchObject({
      mode: "core",
      isFullRuntime: false,
      usesFallbacks: true,
    });
  });

  it("libera o runtime integral somente com 1.037 IDs canônicos e 1.850 entradas reais", () => {
    expect(inspectPack99RuntimeIndex(fullIndex())).toEqual({
      mode: "full",
      reportedAssetCount: 1037,
      canonicalAssetCount: 1037,
      materializedAssetCount: PACK99_FULL_MIN_MATERIALIZED_COUNT,
      isFullRuntime: true,
      usesFallbacks: false,
    });
  });

  it("resolve base e camada pelo mesmo ID canônico", () => {
    const index = fullIndex();
    const canonicalId = "PACK99_CANONICAL_0007";

    expect(findPack99CanonicalAsset(index, canonicalId, "base")?.id).toBe(canonicalId);
    expect(findPack99CanonicalAsset(index, canonicalId, "shadow")?.id).toBe(`${canonicalId}__SHADOW`);
  });

  it("não aceita outro ID canônico como substituto", () => {
    expect(findPack99CanonicalAsset(fullIndex(), "HERO_INEXISTENTE_01", "base")).toBeNull();
  });

  it("resolve a URL pública mesmo quando o índice bootstrap não possui sourcePath", () => {
    expect(pack99PublicUrl(bootstrapAsset(9))).toBe("/assets/runtime/pack99/test/asset-9.png");
  });
});
