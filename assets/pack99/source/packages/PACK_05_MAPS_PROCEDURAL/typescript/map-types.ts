// Hexa Octarina Conquer — Map Types
// Tehkné Solutions

export type AutotileMask = `${0 | 1}${0 | 1}${0 | 1}${0 | 1}`;

export interface MapCell {
  x: number;
  y: number;
  terrainId: string;
  baseTileId: string;
  autotileMask: AutotileMask;
  transitionOverlayId: string | null;
  walkable: boolean;
  movementCost: number;
  hazard: boolean;
  zBase: number;
}

export interface MapSpawn {
  id: string;
  kind: "resource" | "prop";
  assetId: string;
  x: number;
  y: number;
  blocking: boolean;
  zOffset: number;
}

export interface MapDefinition {
  mapId: string;
  name: string;
  version: string;
  seed: number;
  preset: string;
  grid: {
    type: "isometric-diamond";
    width: number;
    height: number;
    tileMasterPx: [number, number];
    tileRuntimePx: [number, number];
    origin: [number, number];
  };
  cells: MapCell[];
  spawns: MapSpawn[];
  landmarks: Array<Record<string, unknown>>;
  pillars: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  starts: Array<{ player: number; x: number; y: number }>;
  objectives: Array<Record<string, unknown>>;
}
