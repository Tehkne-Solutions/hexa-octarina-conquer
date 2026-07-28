import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findPack99CanonicalAsset,
  inspectPack99RuntimeIndex,
  pack99PublicUrl,
  PACK99_FULL_MIN_MATERIALIZED_COUNT,
  resetPack99RuntimeCache,
  resolvePack99MissionAsset,
  resolvePack99SiblingLayer,
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

function mockIndex(index: Pack99RuntimeIndex): void {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => index,
  })));
}

afterEach(() => {
  resetPack99RuntimeCache();
  vi.unstubAllGlobals();
});

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

  it("não aceita outro ID canônico como substituto direto", () => {
    expect(findPack99CanonicalAsset(fullIndex(), "HERO_INEXISTENTE_01", "base")).toBeNull();
  });

  it("resolve a URL pública mesmo quando o índice bootstrap não possui sourcePath", () => {
    expect(pack99PublicUrl(bootstrapAsset(9))).toBe("/assets/runtime/pack99/test/asset-9.png");
  });
});

describe("PACK 99 resilient asset resolution", () => {
  it("usa o sufixo quando o ID canônico solicitado não está materializado", async () => {
    mockIndex({
      assetCount: 1037,
      profile: "full",
      runtimeMode: "full",
      fallback: null,
      assets: [{
        id: "TILE_GRASS_FLAT_CENTER_A_01_ALIAS",
        canonicalId: "TILE_GRASS_FLAT_CENTER_A_01_ALIAS",
        category: "terrain",
        layer: "base",
        sourcePath: "packages/PACK_01_TERRAIN_CORE/A01_GRASS_ANCESTRAL/tiles/TILE_GRASS_FLAT_CENTER_A_01.png",
        web: "client/web/public/assets/runtime/pack99/terrain/TILE_GRASS_FLAT_CENTER_A_01.webp",
      }],
    });

    const asset = await resolvePack99MissionAsset({
      canonicalId: "TILE_GRASS_FLAT_CENTER_A_01",
      sourceSuffixes: ["TILE_GRASS_FLAT_CENTER_A_01.png"],
      required: ["tile", "grass", "flat", "center"],
      preferred: ["a_01"],
    });

    expect(asset?.id).toBe("TILE_GRASS_FLAT_CENTER_A_01_ALIAS");
  });

  it("usa busca semântica quando ID e sufixo não encontram o asset", async () => {
    mockIndex({
      assetCount: 597,
      profile: "core",
      assets: [{
        id: "PROP_STONE_BRIDGE_BUILT_VARIANT_01",
        canonicalId: "PROP_STONE_BRIDGE_BUILT_VARIANT_01",
        category: "prop",
        layer: "base",
        sourcePath: "packages/PACK_04_PROPS/bridges/stone_bridge_built_variant.png",
        web: "client/web/public/assets/runtime/pack99/props/stone_bridge_built_variant.webp",
      }],
    });

    const asset = await resolvePack99MissionAsset({
      canonicalId: "PROP_STONE_BRIDGE_BUILT_NW_SE_01",
      sourceSuffixes: ["missing-bridge.png"],
      required: ["stone", "bridge", "built"],
      preferred: ["variant"],
    });

    expect(asset?.id).toBe("PROP_STONE_BRIDGE_BUILT_VARIANT_01");
  });

  it("resolve shadow equivalente quando o sibling canônico não existe", async () => {
    const base: Pack99RuntimeAsset = {
      id: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
      canonicalId: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
      category: "hero",
      layer: "base",
      sourcePath: "packages/PACK_06_HEROES/HERO_GUARDIAN_01_IDLE_BASE_SW_01.png",
      web: "client/web/public/assets/runtime/pack99/heroes/guardian-base.webp",
    };

    mockIndex({
      assetCount: 597,
      profile: "core",
      assets: [
        base,
        {
          id: "HERO_GUARDIAN_01_IDLE_SHADOW_SW_01",
          canonicalId: "HERO_GUARDIAN_01_IDLE_SHADOW_SW_01",
          category: "hero",
          layer: "shadow",
          sourcePath: "packages/PACK_06_HEROES/HERO_GUARDIAN_01_IDLE_SHADOW_SW_01.png",
          web: "client/web/public/assets/runtime/pack99/heroes/guardian-shadow.webp",
        },
      ],
    });

    const shadow = await resolvePack99SiblingLayer(base, "shadow");
    expect(shadow?.layer).toBe("shadow");
  });
});
