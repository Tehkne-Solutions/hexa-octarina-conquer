import { useMemo, useState } from "react";

import "./pack99-validation-arena.css";

const ROOT = "/assets/runtime/pack99/packages";

interface ValidationAsset {
  id: string;
  label: string;
  group: string;
  path: string;
  shadow?: string;
  emissive?: string;
}

const ASSETS: ValidationAsset[] = [
  {
    id: "terrain-grass",
    label: "Terreno ancestral",
    group: "Terreno",
    path: `${ROOT}/PACK_01_TERRAIN_CORE/A01_GRASS_ANCESTRAL/tiles/TILE_GRASS_FLAT_CENTER_A_01.png`,
  },
  {
    id: "pillar-blue",
    label: "Pilar azul",
    group: "Tabuleiro",
    path: `${ROOT}/PACK_02_BOARD_SYSTEM/P01_PILLARS/assets/PILLAR_BLUE_01.png`,
    shadow: `${ROOT}/PACK_02_BOARD_SYSTEM/P01_PILLARS/assets/PILLAR_BLUE_01_SHADOW.png`,
    emissive: `${ROOT}/PACK_02_BOARD_SYSTEM/P01_PILLARS/assets/PILLAR_BLUE_01_EMISSIVE.png`,
  },
  {
    id: "resource-octarine",
    label: "Cristal octarina",
    group: "Recursos",
    path: `${ROOT}/PACK_03_RESOURCES/nodes/RES_OCTARINE_CRYSTAL_ABUNDANT_01.png`,
    emissive: `${ROOT}/PACK_03_RESOURCES/emissives/RES_OCTARINE_CRYSTAL_ABUNDANT_01_EMISSIVE.png`,
  },
  {
    id: "portal",
    label: "Portal ativo",
    group: "Props",
    path: `${ROOT}/PACK_04_PROPS_OBSTACLES/P04_PORTALS/PROP_PORTAL_ACTIVE_01.png`,
    shadow: `${ROOT}/PACK_04_PROPS_OBSTACLES/P04_PORTALS/PROP_PORTAL_ACTIVE_01_SHADOW.png`,
    emissive: `${ROOT}/PACK_04_PROPS_OBSTACLES/P04_PORTALS/PROP_PORTAL_ACTIVE_01_EMISSIVE.png`,
  },
  {
    id: "mage",
    label: "Mago",
    group: "Heróis",
    path: `${ROOT}/PACK_06_HERO_MAGE/directions/HERO_MAGE_IDLE_BASE_SE_01.png`,
    shadow: `${ROOT}/PACK_06_HERO_MAGE/directions/HERO_MAGE_IDLE_BASE_SE_01_SHADOW.png`,
    emissive: `${ROOT}/PACK_06_HERO_MAGE/directions/HERO_MAGE_IDLE_BASE_SE_01_EMISSIVE.png`,
  },
  {
    id: "warrior",
    label: "Guerreiro",
    group: "Heróis",
    path: `${ROOT}/PACK_07_HERO_ROSTER/warrior/directions/HERO_WARRIOR_01_IDLE_BASE_SW_01.png`,
    shadow: `${ROOT}/PACK_07_HERO_ROSTER/warrior/directions/HERO_WARRIOR_01_IDLE_BASE_SW_01_SHADOW.png`,
    emissive: `${ROOT}/PACK_07_HERO_ROSTER/warrior/directions/HERO_WARRIOR_01_IDLE_BASE_SW_01_EMISSIVE.png`,
  },
  {
    id: "ranger",
    label: "Arqueiro",
    group: "Heróis",
    path: `${ROOT}/PACK_07_HERO_ROSTER/ranger/directions/HERO_RANGER_01_IDLE_BASE_NE_01.png`,
    shadow: `${ROOT}/PACK_07_HERO_ROSTER/ranger/directions/HERO_RANGER_01_IDLE_BASE_NE_01_SHADOW.png`,
    emissive: `${ROOT}/PACK_07_HERO_ROSTER/ranger/directions/HERO_RANGER_01_IDLE_BASE_NE_01_EMISSIVE.png`,
  },
  {
    id: "skeleton",
    label: "Esqueleto",
    group: "Unidades",
    path: `${ROOT}/PACK_08_BASIC_UNITS/skeleton/directions/UNIT_SKELETON_01_IDLE_BASE_NW_01.png`,
    shadow: `${ROOT}/PACK_08_BASIC_UNITS/skeleton/directions/UNIT_SKELETON_01_IDLE_BASE_NW_01_SHADOW.png`,
  },
];

function ArenaSprite({ asset, onLoaded, onFailed }: {
  asset: ValidationAsset;
  onLoaded: (id: string) => void;
  onFailed: (id: string) => void;
}) {
  return (
    <article className={`pack99-actor pack99-actor-${asset.id}`}>
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
  const [loaded, setLoaded] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [showEmissive, setShowEmissive] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const status = useMemo(() => {
    if (failed.length > 0) return `${failed.length} asset(s) com falha`;
    if (loaded.length === ASSETS.length) return "Todos os assets principais carregados";
    return `Carregando ${loaded.length}/${ASSETS.length}`;
  }, [failed, loaded]);

  const markLoaded = (id: string) => {
    setLoaded((current) => current.includes(id) ? current : [...current, id]);
    setFailed((current) => current.filter((entry) => entry !== id));
  };

  const markFailed = (id: string) => {
    setFailed((current) => current.includes(id) ? current : [...current, id]);
  };

  return (
    <main className={`pack99-validation ${showGrid ? "show-grid" : ""} ${showEmissive ? "show-emissive" : "hide-emissive"}`}>
      <header className="pack99-toolbar">
        <div>
          <p>PACK 99 · RUNTIME ACTIVATION</p>
          <h1>Arena de Validação</h1>
          <span className={failed.length > 0 ? "pack99-status failed" : "pack99-status"}>{status}</span>
        </div>
        <nav>
          <button type="button" className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)}>Grade</button>
          <button type="button" className={showEmissive ? "active" : ""} onClick={() => setShowEmissive((value) => !value)}>Emissivos</button>
          <a href="/">Voltar ao jogo</a>
        </nav>
      </header>

      <section className="pack99-stage" aria-label="Arena visual do PACK 99">
        <div className="pack99-board">
          {Array.from({ length: 25 }, (_, index) => (
            <img
              key={index}
              src={`${ROOT}/PACK_01_TERRAIN_CORE/A01_GRASS_ANCESTRAL/tiles/TILE_GRASS_FLAT_CENTER_${index % 3 === 0 ? "A" : index % 3 === 1 ? "B" : "C"}_01.png`}
              alt=""
              aria-hidden="true"
            />
          ))}
        </div>
        {ASSETS.slice(1).map((asset) => (
          <ArenaSprite key={asset.id} asset={asset} onLoaded={markLoaded} onFailed={markFailed} />
        ))}
      </section>

      <aside className="pack99-diagnostics">
        <strong>Diagnóstico em tempo real</strong>
        <span>Base runtime: <code>/assets/runtime/pack99</code></span>
        <span>Carregados: <b>{loaded.length}</b></span>
        <span>Falhas: <b>{failed.length}</b></span>
        {failed.length > 0 && <code>{failed.join(", ")}</code>}
      </aside>
    </main>
  );
}
