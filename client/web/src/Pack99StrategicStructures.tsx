import { useEffect, useMemo, useState } from "react";

import type { ClaimedCell, InfluenceEdge } from "./go-dots-logic";
import {
  loadPack99RuntimeState,
  pack99PublicUrl,
  resolvePack99MissionAsset,
  type Pack99MissionAssetReference,
} from "./pack99-runtime";
import { progressiveBoardPosition } from "./progressive-board-projection";

interface Pack99StrategicStructuresProps {
  influenceEdges: InfluenceEdge[];
  claimedCells: ClaimedCell[];
  building: "farm" | "tower" | null;
}

type StructureKey = "blueTower" | "redTower" | "purpleCrystal" | "blueCrystal" | "fortress" | "portal" | "farm" | "tower";

type AssetMap = Partial<Record<StructureKey, string | null>>;

const REFERENCES: Record<StructureKey, Pack99MissionAssetReference> = {
  blueTower: {
    canonicalId: "PROP_TOWER_BLUE_01",
    sourceSuffixes: ["PROP_TOWER_BLUE_01.png"],
    required: ["prop", "tower", "blue"],
    preferred: ["base", "01"],
  },
  redTower: {
    canonicalId: "PROP_TOWER_RED_01",
    sourceSuffixes: ["PROP_TOWER_RED_01.png"],
    required: ["prop", "tower", "red"],
    preferred: ["base", "01"],
  },
  purpleCrystal: {
    canonicalId: "RES_OCTARINE_CRYSTAL_ABUNDANT_01",
    sourceSuffixes: ["RES_OCTARINE_CRYSTAL_ABUNDANT_01.png"],
    required: ["res", "octarine", "crystal", "abundant"],
    preferred: ["base", "01"],
  },
  blueCrystal: {
    canonicalId: "RES_MANA_BLUE_ABUNDANT_01",
    sourceSuffixes: ["RES_MANA_BLUE_ABUNDANT_01.png"],
    required: ["res", "mana", "blue", "abundant"],
    preferred: ["base", "01"],
  },
  fortress: {
    canonicalId: "TERR_FORT_BLUE_01",
    sourceSuffixes: ["TERR_FORT_BLUE_01.png"],
    required: ["territory", "fort", "blue"],
    preferred: ["base", "01"],
  },
  portal: {
    canonicalId: "PROP_PORTAL_ACTIVE_01",
    sourceSuffixes: ["PROP_PORTAL_ACTIVE_01.png"],
    required: ["prop", "portal", "active"],
    preferred: ["base", "01"],
  },
  farm: {
    sourceSuffixes: ["PROP_FARM_BUILT_01.png"],
    required: ["prop", "farm", "built"],
    preferred: ["base", "01"],
  },
  tower: {
    canonicalId: "PROP_TOWER_BLUE_01",
    sourceSuffixes: ["PROP_TOWER_BLUE_01.png"],
    required: ["prop", "tower", "blue"],
    preferred: ["base", "01"],
  },
};

async function loadAsset(reference: Pack99MissionAssetReference): Promise<string | null> {
  return pack99PublicUrl(await resolvePack99MissionAsset(reference));
}

function edgeMidpoint(edge: InfluenceEdge) {
  return progressiveBoardPosition((edge.start.x + edge.end.x) / 2, (edge.start.y + edge.end.y) / 2);
}

export function Pack99StrategicStructures({ influenceEdges, claimedCells, building }: Pack99StrategicStructuresProps) {
  const [assets, setAssets] = useState<AssetMap>({});
  const [strictFullRuntime, setStrictFullRuntime] = useState(
    () => document.documentElement.dataset.pack99Full === "true",
  );

  useEffect(() => {
    let active = true;
    void loadPack99RuntimeState()
      .then((state) => {
        if (active) setStrictFullRuntime(state.isFullRuntime);
      })
      .catch(() => {
        if (active) setStrictFullRuntime(false);
      });
    void Promise.all((Object.keys(REFERENCES) as StructureKey[]).map(async (key) => [key, await loadAsset(REFERENCES[key])] as const))
      .then((entries) => { if (active) setAssets(Object.fromEntries(entries)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const towers = useMemo(() => influenceEdges.map((edge, index) => ({
    id: edge.id,
    owner: edge.owner,
    position: edgeMidpoint(edge),
    emphasized: index % 2 === 0,
  })), [influenceEdges]);

  const crystals = useMemo(() => claimedCells.map((cell, index) => ({
    id: cell.id,
    owner: cell.owner,
    position: progressiveBoardPosition(cell.x + 0.5, cell.y + 0.5),
    major: index % 3 === 0,
  })), [claimedCells]);

  const landmarkStructures = [
    { id: "orun-fortress", key: "fortress" as const, x: 1.2, y: 5.2, owner: "player" },
    { id: "octarine-sanctum", key: "purpleCrystal" as const, x: 3.1, y: 3.1, owner: "neutral" },
    { id: "enemy-portal", key: "portal" as const, x: 5.1, y: 1.1, owner: "enemy" },
    { id: "mill-build", key: (building ?? "farm") as "farm" | "tower", x: 5.05, y: 1.05, owner: "player", hidden: !building },
  ];

  return (
    <div className="pack99-strategic-structures" aria-hidden="true">
      {landmarkStructures.map((item) => {
        if (item.hidden) return null;
        const position = progressiveBoardPosition(item.x, item.y);
        const source = assets[item.key];
        if (!source && strictFullRuntime) return null;
        return (
          <span
            key={item.id}
            className={`pack99-map-structure structure-${item.key} owner-${item.owner}`}
            data-pack99-canonical-id={REFERENCES[item.key].canonicalId ?? "missing-from-pack99"}
            style={{ left: `${position.left}%`, top: `${position.top}%` }}
          >
            <i className="structure-aura" />
            {source ? <img src={source} alt="" draggable={false} /> : <b className="structure-fallback" />}
          </span>
        );
      })}

      {towers.map((tower) => {
        const key: StructureKey = tower.owner === "player" ? "blueTower" : "redTower";
        const source = assets[key];
        if (!source && strictFullRuntime) return null;
        return (
          <span
            key={tower.id}
            className={`pack99-influence-tower owner-${tower.owner} ${tower.emphasized ? "is-emphasized" : ""}`}
            data-pack99-canonical-id={REFERENCES[key].canonicalId}
            style={{ left: `${tower.position.left}%`, top: `${tower.position.top}%` }}
          >
            <i />
            {source ? <img src={source} alt="" draggable={false} /> : <b />}
          </span>
        );
      })}

      {crystals.map((crystal) => {
        const key: StructureKey = crystal.owner === "player" ? "blueCrystal" : "purpleCrystal";
        const source = assets[key];
        if (!source && strictFullRuntime) return null;
        return (
          <span
            key={crystal.id}
            className={`pack99-territory-crystal owner-${crystal.owner} ${crystal.major ? "is-major" : ""}`}
            data-pack99-canonical-id={REFERENCES[key].canonicalId}
            style={{ left: `${crystal.position.left}%`, top: `${crystal.position.top}%` }}
          >
            <i />
            {source ? <img src={source} alt="" draggable={false} /> : <b />}
          </span>
        );
      })}
    </div>
  );
}
