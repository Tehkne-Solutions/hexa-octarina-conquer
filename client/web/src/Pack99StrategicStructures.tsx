import { useEffect, useMemo, useState } from "react";

import type { ClaimedCell, InfluenceEdge } from "./go-dots-logic";
import { pack99PublicUrl, resolvePack99Asset } from "./pack99-runtime";
import { progressiveBoardPosition } from "./progressive-board-projection";

interface Pack99StrategicStructuresProps {
  influenceEdges: InfluenceEdge[];
  claimedCells: ClaimedCell[];
  building: "farm" | "tower" | null;
}

type StructureKey = "blueTower" | "redTower" | "purpleCrystal" | "blueCrystal" | "fortress" | "portal" | "farm" | "tower";

type AssetMap = Partial<Record<StructureKey, string | null>>;

const QUERIES: Record<StructureKey, { required: string[]; preferred: string[] }> = {
  blueTower: { required: ["tower"], preferred: ["blue", "alliance", "crystal", "base", "01"] },
  redTower: { required: ["tower"], preferred: ["red", "enemy", "corrupt", "base", "01"] },
  purpleCrystal: { required: ["crystal"], preferred: ["octarine", "purple", "large", "base", "01"] },
  blueCrystal: { required: ["crystal"], preferred: ["blue", "mana", "large", "base", "01"] },
  fortress: { required: ["fortress"], preferred: ["castle", "stronghold", "blue", "base", "01"] },
  portal: { required: ["portal"], preferred: ["active", "purple", "base", "01"] },
  farm: { required: ["farm"], preferred: ["arcane", "built", "base", "01"] },
  tower: { required: ["tower"], preferred: ["runic", "built", "blue", "base", "01"] },
};

async function loadAsset(query: { required: string[]; preferred: string[] }): Promise<string | null> {
  return pack99PublicUrl(await resolvePack99Asset(query.required, query.preferred));
}

function edgeMidpoint(edge: InfluenceEdge) {
  return progressiveBoardPosition((edge.start.x + edge.end.x) / 2, (edge.start.y + edge.end.y) / 2);
}

export function Pack99StrategicStructures({ influenceEdges, claimedCells, building }: Pack99StrategicStructuresProps) {
  const [assets, setAssets] = useState<AssetMap>({});

  useEffect(() => {
    let active = true;
    void Promise.all((Object.keys(QUERIES) as StructureKey[]).map(async (key) => [key, await loadAsset(QUERIES[key])] as const))
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
        return (
          <span key={item.id} className={`pack99-map-structure structure-${item.key} owner-${item.owner}`} style={{ left: `${position.left}%`, top: `${position.top}%` }}>
            <i className="structure-aura" />
            {source ? <img src={source} alt="" draggable={false} /> : <b className="structure-fallback" />}
          </span>
        );
      })}

      {towers.map((tower) => {
        const source = tower.owner === "player" ? assets.blueTower : assets.redTower;
        return (
          <span key={tower.id} className={`pack99-influence-tower owner-${tower.owner} ${tower.emphasized ? "is-emphasized" : ""}`} style={{ left: `${tower.position.left}%`, top: `${tower.position.top}%` }}>
            <i />
            {source ? <img src={source} alt="" draggable={false} /> : <b />}
          </span>
        );
      })}

      {crystals.map((crystal) => {
        const source = crystal.owner === "player" ? assets.blueCrystal : assets.purpleCrystal;
        return (
          <span key={crystal.id} className={`pack99-territory-crystal owner-${crystal.owner} ${crystal.major ? "is-major" : ""}`} style={{ left: `${crystal.position.left}%`, top: `${crystal.position.top}%` }}>
            <i />
            {source ? <img src={source} alt="" draggable={false} /> : <b />}
          </span>
        );
      })}
    </div>
  );
}
