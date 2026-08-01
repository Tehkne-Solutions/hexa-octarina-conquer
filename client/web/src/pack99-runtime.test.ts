import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findPack99CanonicalAsset,
  inspectPack99RuntimeIndex,
  loadPack99Index,
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
  const assets = Array.from({ length: PACK99_FULL_MIN_MATERIALIZED_COUNT }, (_, index): Pack99RuntimeAsset => {
    const canonicalId = `PACK99_CANONICAL_${String(index).padStart(4, "0")}`;
    return {
      id: canonicalId,
      canonicalId,
      category: "test",
      layer: "base",
      sourcePath: `packages/PACK_TEST/${canonicalId}.png`,
      web: `/assets/runtime/packages/PACK_TEST/${canonicalId}.png`,
    };
  });
  return {
    profile: "full",
    runtimeMode: "full",
    assetCount: 1037,
    canonicalAssetCount: 1037,
    materializedAssetCount: assets.length,
    fallback: null,
    assets,
    signature: "Tehkné Solutions",
  };
}

function mockIndex(index: Pack99RuntimeIndex): void {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => index })));
}

afterEach(() => {
  resetPack99RuntimeCache();
  vi.unstubAllGlobals();
});

describe("PACK 99 runtime gate", () => {
  it("mantém bootstrap abaixo do contrato integral", () => {
    const index: Pack99RuntimeIndex = {
      profile: "bootstrap",
      assetCount: 33,
      fallback: "procedural",
      assets: Array.from({ length: 33 }, (_, index) => bootstrapAsset(index)),
    };
    expect(inspectPack99RuntimeIndex(index)).toMatchObject({ mode: "bootstrap", isFullRuntime: false, usesFallbacks: true });
  });

  it("não aceita declaração full sem 1037 entradas materializadas", () => {
    const index: Pack99RuntimeIndex = {
      profile: "full",
      runtimeMode: "full",
      assetCount: 1037,
      canonicalAssetCount: 1037,
      fallback: null,
      assets: [bootstrapAsset(1)],
    };
    expect(inspectPack99RuntimeIndex(index)).toMatchObject({ isFullRuntime: false, usesFallbacks: true });
  });

  it("libera o runtime integral com 1037 IDs e 1037 arquivos canônicos", () => {
    expect(inspectPack99RuntimeIndex(fullIndex())).toEqual({
      mode: "full",
      reportedAssetCount: 1037,
      canonicalAssetCount: 1037,
      materializedAssetCount: 1037,
      isFullRuntime: true,
      usesFallbacks: false,
    });
  });

  it("adapta assets-runtime.json para a API usada pelo jogo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        packId: "HOC_PACK_99_FINAL_RUNTIME",
        version: "1.0.1",
        profile: "full",
        assetCount: 1037,
        unresolved: [],
        assets: Array.from({ length: 1037 }, (_, index) => ({
          id: `ASSET_${index}`,
          category: "test",
          _runtimeFile: `packages/PACK_TEST/ASSET_${index}.png`,
        })),
      }),
    })));
    const index = await loadPack99Index();
    expect(index.assets).toHaveLength(1037);
    expect(index.assets[0].web).toBe("/assets/runtime/packages/PACK_TEST/ASSET_0.png");
    expect(inspectPack99RuntimeIndex(index).isFullRuntime).toBe(true);
  });

  it("resolve URL pública do runtime canônico", () => {
    expect(pack99PublicUrl(fullIndex().assets[9])).toBe("/assets/runtime/packages/PACK_TEST/PACK99_CANONICAL_0009.png");
  });
});

describe("PACK 99 resilient asset resolution", () => {
  it("usa sufixo físico quando o ID solicitado não está no registry", async () => {
    mockIndex({
      assetCount: 1037,
      profile: "full",
      runtimeMode: "full",
      fallback: null,
      assets: [{
        id: "TILE_GRASS_ALIAS",
        canonicalId: "TILE_GRASS_ALIAS",
        category: "terrain",
        layer: "base",
        sourcePath: "packages/PACK_01/TILE_GRASS_FLAT_CENTER_A_01.png",
        web: "/assets/runtime/packages/PACK_01/TILE_GRASS_FLAT_CENTER_A_01.png",
      }],
    });
    const asset = await resolvePack99MissionAsset({
      canonicalId: "TILE_GRASS_FLAT_CENTER_A_01",
      sourceSuffixes: ["TILE_GRASS_FLAT_CENTER_A_01.png"],
      required: ["tile", "grass"],
      preferred: ["center"],
    });
    expect(asset?.id).toBe("TILE_GRASS_ALIAS");
  });

  it("resolve sibling shadow quando disponível", async () => {
    const base: Pack99RuntimeAsset = {
      id: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
      canonicalId: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
      category: "hero",
      layer: "base",
      sourcePath: "packages/PACK_07/HERO_GUARDIAN_01_IDLE_BASE_SW_01.png",
      web: "/assets/runtime/packages/PACK_07/HERO_GUARDIAN_01_IDLE_BASE_SW_01.png",
    };
    mockIndex({
      assetCount: 597,
      profile: "core",
      assets: [base, {
        id: "HERO_GUARDIAN_01_IDLE_BASE_SW_01__SHADOW",
        canonicalId: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
        category: "hero",
        layer: "shadow",
        sourcePath: "packages/PACK_07/HERO_GUARDIAN_01_IDLE_BASE_SW_01_SHADOW.png",
        web: "/assets/runtime/packages/PACK_07/HERO_GUARDIAN_01_IDLE_BASE_SW_01_SHADOW.png",
      }],
    });
    expect((await resolvePack99SiblingLayer(base, "shadow"))?.layer).toBe("shadow");
  });

  it("não aceita outro ID canônico como substituto direto", () => {
    expect(findPack99CanonicalAsset(fullIndex(), "HERO_INEXISTENTE_01", "base")).toBeNull();
  });
});
