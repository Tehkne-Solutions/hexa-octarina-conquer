import { compareHexes, hexKey, hexNeighbors } from "./hex-coordinates.js";

function controllerOf(cell) {
  return cell?.controllerFactionId ?? null;
}

function orderedKeys(keys) {
  return [...keys].sort((left, right) => compareHexes(
    Object.fromEntries([["q", Number(left.split(",")[0])], ["r", Number(left.split(",")[1])]]),
    Object.fromEntries([["q", Number(right.split(",")[0])], ["r", Number(right.split(",")[1])]]),
  ));
}

function existingNeighbors(map, cell) {
  return hexNeighbors(cell)
    .map((hex) => map.get(hex))
    .filter(Boolean);
}

export function calculateInfluence(map) {
  const byHex = new Map();
  for (const cell of map.orderedCells()) byHex.set(cell.id, {});

  for (const source of map.orderedCells()) {
    const factionId = controllerOf(source);
    if (!factionId) continue;
    const add = (target, amount) => {
      const current = byHex.get(target.id) ?? {};
      current[factionId] = (current[factionId] ?? 0) + amount;
      byHex.set(target.id, current);
    };
    add(source, 2);
    for (const neighbor of existingNeighbors(map, source)) add(neighbor, 1);
  }

  return Object.fromEntries(
    [...byHex.entries()].map(([key, influence]) => [
      key,
      Object.fromEntries(Object.entries(influence).sort(([a], [b]) => a.localeCompare(b))),
    ]),
  );
}

export function applyInfluence(map) {
  const influence = calculateInfluence(map);
  for (const cell of map.orderedCells()) map.updateCell(cell.id, { influence: influence[cell.id] ?? {} });
  return influence;
}

export function findChains(map, factionId) {
  const candidates = new Set(
    map.orderedCells().filter((cell) => controllerOf(cell) === factionId).map((cell) => cell.id),
  );
  const chains = [];

  while (candidates.size) {
    const start = orderedKeys(candidates)[0];
    const pending = [start];
    const members = new Set();
    candidates.delete(start);

    while (pending.length) {
      const key = pending.shift();
      if (!key || members.has(key)) continue;
      members.add(key);
      const cell = map.get(key);
      if (!cell) continue;
      for (const neighbor of existingNeighbors(map, cell)) {
        if (controllerOf(neighbor) !== factionId || !candidates.has(neighbor.id)) continue;
        candidates.delete(neighbor.id);
        pending.push(neighbor.id);
      }
    }

    const liberties = new Set();
    for (const key of members) {
      const cell = map.get(key);
      if (!cell) continue;
      for (const neighbor of existingNeighbors(map, cell)) {
        if (!members.has(neighbor.id) && controllerOf(neighbor) !== factionId && controllerOf(neighbor) === null) {
          liberties.add(neighbor.id);
        }
      }
    }

    chains.push({
      factionId,
      members: orderedKeys(members),
      liberties: orderedKeys(liberties),
      libertyCount: liberties.size,
      surrounded: liberties.size === 0,
      isolated: liberties.size <= 1,
    });
  }

  return chains.sort((a, b) => a.members[0].localeCompare(b.members[0]));
}

export function analyzeGoState(map, factionIds) {
  const influence = applyInfluence(map);
  const factions = [...new Set(factionIds.map(String))].sort();
  return {
    influence,
    chains: Object.fromEntries(factions.map((factionId) => [factionId, findChains(map, factionId)])),
  };
}

export function retreatLiberties(map, factionId, hexOrKey) {
  const cell = map.get(hexOrKey);
  if (!cell || controllerOf(cell) !== factionId) return [];
  return existingNeighbors(map, cell)
    .filter((neighbor) => controllerOf(neighbor) === null || controllerOf(neighbor) === factionId)
    .map((neighbor) => neighbor.id)
    .sort();
}

export function isSurrounded(map, factionId, hexOrKey) {
  const key = typeof hexOrKey === "string" ? hexOrKey : hexKey(hexOrKey);
  return findChains(map, factionId).some((chain) => chain.members.includes(key) && chain.surrounded);
}
