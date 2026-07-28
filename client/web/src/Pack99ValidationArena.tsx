import { useEffect, useMemo, useState } from "react";

import "./pack99-validation-arena.css";

const INDEX_URL = "/assets/runtime/pack99/runtime-index.json";

interface RuntimeAsset {
  id: string;
  canonicalId?: string;
  category?: string;
  layer?: "base" | "shadow" | "emissive" | "faction-mask" | "spritesheet" | "atlas" | "preview";
  sourcePath?: string;
  webPublic?: string;
  web: string;
}

interface RuntimeIndex {
  assetCount: number;
  canonicalAssetCount?: number;
  materializedAssetCount?: number;
  runtimeMode?: "bootstrap" | "core" | "full";
  profile?: string;
  fallback?: string | null | false;
  assets: RuntimeAsset[];
}

interface AssetDefinition {
  id: string;
  canonicalId: string;
  label: string;
  group: string;
  candidates: string[];
  shadowCandidates?: string[];
  emissiveCandidates?: string[];
}

interface ValidationAsset {
  id: string;
  canonicalId: string;
  label: string;
  group: string;
  path: string;
  shadow?: string;
  emissive?: string;
}

const DEFINITIONS: AssetDefinition[] = [
  {
    id: "terrain-grass",
    canonicalId: "TILE_GRASS_FLAT_CENTER_A_01",
    label: "Terreno ancestral",
    group: "Terreno",
    candidates: ["TILE_GRASS_FLAT_CENTER_A_01.png", "GRASS_FLAT_CENTER_A_01.png"],
  },
  {
    id: "pillar-blue",
    canonicalId: "PILLAR_BLUE_01",
    label: "Pilar azul",
    group: "Tabuleiro",
    candidates: ["PILLAR_BLUE_01.png", "PILAR_BLUE_01.png"],
    shadowCandidates: ["PILLAR_BLUE_01_SHADOW.png", "PILAR_BLUE_01_SHADOW.png"],
    emissiveCandidates: ["PILLAR_BLUE_01_EMISSIVE.png", "PILAR_BLUE_01_EMISSIVE.png"],
  },
  {
    id: "resource-octarine",
    canonicalId: "RES_OCTARINE_CRYSTAL_ABUNDANT_01",
    label: "Cristal octarina",
    group: "Recursos",
    candidates: ["RES_OCTARINE_CRYSTAL_ABUNDANT_01.png", "OCTARINE_CRYSTAL", "CRISTAL_OCTARINA"],
    emissiveCandidates: ["RES_OCTARINE_CRYSTAL_ABUNDANT_01_EMISSIVE.png", "OCTARINE_CRYSTAL_EMISSIVE"],
  },
  {
    id: "portal",
    canonicalId: "PROP_PORTAL_ACTIVE_01",
    label: "Portal ativo",
    group: "Props",
    candidates: ["PROP_PORTAL_ACTIVE_01.png", "PORTAL_ACTIVE_01.png"],
    shadowCandidates: ["PROP_PORTAL_ACTIVE_01_SHADOW.png", "PORTAL_ACTIVE_01_SHADOW.png"],
    emissiveCandidates: ["PROP_PORTAL_ACTIVE_01_EMISSIVE.png", "PORTAL_ACTIVE_01_EMISSIVE.png"],
  },
  {
    id: "mage",
    canonicalId: "HERO_MAGE_IDLE_BASE_SE_01",
    label: "Mago",
    group: "Heróis",
    candidates: ["HERO_MAGE_IDLE_BASE_SE_01.png", "MAGE_IDLE_BASE_SE", "HERO_MAGE"],
    shadowCandidates: ["HERO_MAGE_IDLE_BASE_SE_01_SHADOW.png", "MAGE_IDLE_BASE_SE_01_SHADOW.png"],
    emissiveCandidates: ["HERO_MAGE_IDLE_BASE_SE_01_EMISSIVE.png", "MAGE_IDLE_BASE_SE_01_EMISSIVE.png"],
  },
  {
    id: "warrior",
    canonicalId: "HERO_WARRIOR_01_IDLE_BASE_SW_01",
    label: "Guerreiro",
    group: "Heróis",
    candidates: ["HERO_WARRIOR_01_IDLE_BASE_SW_01.png", "WARRIOR_01_IDLE_BASE_SW", "HERO_WARRIOR"],
    shadowCandidates: ["HERO_WARRIOR_01_IDLE_BASE_SW_01_SHADOW.png", "WARRIOR_01_IDLE_BASE_SW_01_SHADOW.png"],
    emissiveCandidates: ["HERO_WARRIOR_01_IDLE_BASE_SW_01_EMISSIVE.png", "WARRIOR_01_IDLE_BASE_SW_01_EMISSIVE.png"],
  },
  {
    id: "ranger",
    canonicalId: "HERO_RANGER_01_IDLE_BASE_NE_01",
    label: "Arqueiro",
    group: "Heróis",
    candidates: ["HERO_RANGER_01_IDLE_BASE_NE_01.png", "RANGER_01_IDLE_BASE_NE", "HERO_RANGER", "ARCHER_IDLE"],
    shadowCandidates: ["HERO_RANGER_01_IDLE_BASE_NE_01_SHADOW.png", "RANGER_01_IDLE_BASE_NE_01_SHADOW.png"],
    emissiveCandidates: ["HERO_RANGER_01_IDLE_BASE_NE_01_EMISSIVE.png", "RANGER_01_IDLE_BASE_NE_01_EMISSIVE.png"],
  },
  {
    id: "skeleton",
    canonicalId: "UNIT_SKELETON_01_IDLE_BASE_NW_01",
    label: "Esqueleto",
    group: "Unidades",
    candidates: ["UNIT_SKELETON_01_IDLE_BASE_NW_01.png", "SKELETON_01_IDLE_BASE_NW", "UNIT_SKELETON"],
    shadowCandidates: ["UNIT_SKELETON_01_IDLE_BASE_NW_01_SHADOW.png", "SKELETON_01_IDLE_BASE_NW_01_SHADOW.png"],
  },
];

function normalize(value: string): string {
  return value.replaceAll("\\", "/").toUpperCase();
}

function publicPath(asset: RuntimeAsset): string {
  if (asset.webPublic) return asset.webPublic;
  const marker = "client/web/public/";
  const normalized = asset.web?.replaceAll("\\", "/") ?? "";
  const offset = normalized.toLowerCase().indexOf(marker);
  return offset >= 0 ? `/${normalized.slice(offset + marker.length)}` : normalized;
}

function canonicalId(asset: RuntimeAsset): string {
  return asset.canonicalId ?? asset.id.replace(/__(?:SHADOW|EMISSIVE|FACTION_MASK|SPRITESHEET|ATLAS|PREVIEW)$/, "");
}

function resolveCanonicalLayer(
  assets: RuntimeAsset[],
  wantedCanonicalId: string,
  layer: "base" | "shadow" | "emissive",
): string | undefined {
  const matching = assets.filter((asset) => canonicalId(asset) === wantedCanonicalId);
  const exact = matching.find((asset) => asset.layer === layer)
    ?? (layer === "base" ? matching.find((asset) => asset.id === wantedCanonicalId) : undefined);
  return exact ? publicPath(exact) : undefined;
}

function resolveCandidate(assets: RuntimeAsset[], candidates: string[] = []): string | undefined {
  for (const candidate of candidates) {
    const wanted = normalize(candidate);
    const exact = assets.find((asset) => {
      const source = normalize(asset.sourcePath ?? asset.web ?? asset.id);
      return source.endsWith(`/${wanted}`) || source === wanted;
    });
    if (exact) return publicPath(exact);
  }
  for (const candidate of candidates) {
    const wanted = normalize(candidate).replace(/\.PNG$/, "");
    const partial = assets.find((asset) => normalize(asset.sourcePath ?? asset.web ?? asset.id).includes(wanted));
    if (partial) return publicPath(partial);
  }
  return undefined;
}

function isFullIndex(index: RuntimeIndex): boolean {
  return (index.runtimeMode ?? index.profile) === "full"
    && index.fallback === null
    && index.assetCount === 1037
    && index.canonicalAssetCount === 1037
    && index.assets.length >= 1850;
}

function resolveAssets(index: RuntimeIndex): { assets: ValidationAsset[]; missing: string[]; full: boolean } {
  const missing: string[] = [];
  const full = isFullIndex(index);
  const assets = DEFINITIONS.map((definition) => {
    const path = full
      ? resolveCanonicalLayer(index.assets, definition.canonicalId, "base")
      : resolveCandidate(index.assets, definition.candidates);
    if (!path) missing.push(definition.id);
    return {
      id: definition.id,
      canonicalId: definition.canonicalId,
      label: definition.label,
      group: definition.group,
      path: path ?? "",
      shadow: full
        ? resolveCanonicalLayer(index.assets, definition.canonicalId, "shadow")
        : resolveCandidate(index.assets, definition.shadowCandidates),
      emissive: full
        ? resolveCanonicalLayer(index.assets, definition.canonicalId, "emissive")
        : resolveCandidate(index.assets, definition.emissiveCandidates),
    };
  });
  return { assets, missing, full };
}

function ArenaSprite({ asset, onLoaded, onFailed }: {
  asset: ValidationAsset;
  onLoaded: (id: string) => void;
  onFailed: (id: string) => void;
}) {
  if (!asset.path) return null;
  return (
    <article className={`pack99-actor pack99-actor-${asset.id}`} data-pack99-canonical-id={asset.canonicalId}>
      <div className="pack99-sprite-stack">
        {asset.shadow && <img className="pack99-layer pack99-shadow" src={asset.shadow} alt="" aria-hidden="true" />}
        <img
          className="pack99-layer pack99-base"
          src={asset.path}
          alt={asset.label}
          onLoad={() => onLoaded(asset.id)}
          onError={() => onFailed(asset.id)}
        />
        {asset.emissive && <img className="pack99-layer pack99-emissive" src={asset.emissive} alt="" aria-hidden="true" />}
      </div>
      <span><small>{asset.group}</small>{asset.label}</span>
    </article>
  );
}

export function Pack99ValidationArena() {
  const [runtimeAssets, setRuntimeAssets] = useState<ValidationAsset[]>([]);
  const [indexCount, setIndexCount] = useState(0);
  const [canonicalCount, setCanonicalCount] = useState(0);
  const [fullRuntime, setFullRuntime] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [showEmissive, setShowEmissive] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(INDEX_URL, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Índice HTTP ${response.status}`);
        return response.json() as Promise<RuntimeIndex>;
      })
      .then((index) => {
        if (!active) return;
        const resolved = resolveAssets(index);
        setRuntimeAssets(resolved.assets);
        setUnresolved(resolved.missing);
        setIndexCount(index.assets.length);
        setCanonicalCount(index.canonicalAssetCount ?? index.assetCount ?? 0);
        setFullRuntime(resolved.full);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setIndexError(error instanceof Error ? error.message : "Falha ao carregar o índice do PACK 99");
      });
    return () => { active = false; };
  }, []);

  const terrain = runtimeAssets.find((asset) => asset.id === "terrain-grass");
  const visibleActors = runtimeAssets.filter((asset) => asset.id !== "terrain-grass");
  const totalFailures = failed.length + unresolved.length + (indexError ? 1 : 0);

  const status = useMemo(() => {
    if (indexError) return "Índice do runtime indisponível";
    if (unresolved.length > 0) return `${unresolved.length} ID(s) não resolvido(s)`;
    if (failed.length > 0) return `${failed.length} asset(s) com falha`;
    if (runtimeAssets.length > 0 && loaded.length === runtimeAssets.length - 1) return "Todos os assets principais carregados";
    return runtimeAssets.length > 0 ? `Carregando ${loaded.length}/${runtimeAssets.length - 1}` : "Carregando índice do PACK 99";
  }, [failed, indexError, loaded, runtimeAssets, unresolved]);

  const markLoaded = (id: string) => {
    setLoaded((current) => current.includes(id) ? current : [...current, id]);
    setFailed((current) => current.filter((entry) => entry !== id));
  };

  const markFailed = (id: string) => {
    setFailed((current) => current.includes(id) ? current : [...current, id]);
  };

  return (
    <main className={`pack99-validation ${showGrid ? "show-grid" : ""} ${showEmissive ? "show-emissive" : "hide-emissive"}`} data-pack99-full={String(fullRuntime)}>
      <header className="pack99-toolbar">
        <div>
          <p>PACK 99 · RUNTIME ACTIVATION</p>
          <h1>Arena de Validação</h1>
          <span className={totalFailures > 0 ? "pack99-status failed" : "pack99-status"}>{status}</span>
        </div>
        <nav>
          <button type="button" className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)}>Grade</button>
          <button type="button" className={showEmissive ? "active" : ""} onClick={() => setShowEmissive((value) => !value)}>Emissivos</button>
          <a href="/">Voltar ao jogo</a>
        </nav>
      </header>

      <section className="pack99-stage" aria-label="Arena visual do PACK 99">
        <div className="pack99-board">
          {terrain?.path && Array.from({ length: 25 }, (_, index) => (
            <img key={index} src={terrain.path} alt="" aria-hidden="true" />
          ))}
        </div>
        {visibleActors.map((asset) => (
          <ArenaSprite key={asset.id} asset={asset} onLoaded={markLoaded} onFailed={markFailed} />
        ))}
      </section>

      <aside className="pack99-diagnostics">
        <strong>Diagnóstico em tempo real</strong>
        <span>Índice: <code>{INDEX_URL}</code></span>
        <span>Modo: <b>{fullRuntime ? "full canônico" : "bootstrap compatível"}</b></span>
        <span>IDs canônicos: <b>{canonicalCount}</b></span>
        <span>Entradas materializadas: <b>{indexCount}</b></span>
        <span>Carregados: <b>{loaded.length}</b></span>
        <span>Falhas HTTP: <b>{failed.length}</b></span>
        <span>IDs não resolvidos: <b>{unresolved.length}</b></span>
        {indexError && <code>{indexError}</code>}
        {unresolved.length > 0 && <code>{unresolved.join(", ")}</code>}
        {failed.length > 0 && <code>{failed.join(", ")}</code>}
      </aside>
    </main>
  );
}
