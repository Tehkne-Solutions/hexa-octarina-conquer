const INTEGER_COORDINATE = /^-?\d+$/;

export const HEX_DIRECTIONS = Object.freeze({
  E: Object.freeze({ q: 1, r: 0 }),
  NE: Object.freeze({ q: 1, r: -1 }),
  NW: Object.freeze({ q: 0, r: -1 }),
  W: Object.freeze({ q: -1, r: 0 }),
  SW: Object.freeze({ q: -1, r: 1 }),
  SE: Object.freeze({ q: 0, r: 1 }),
});

export const HEX_DIRECTION_ORDER = Object.freeze(["E", "NE", "NW", "W", "SW", "SE"]);

export function assertAxialCoordinate(value, label = "hex") {
  if (!value || !Number.isInteger(value.q) || !Number.isInteger(value.r)) {
    throw new TypeError(`${label} must contain integer q and r coordinates`);
  }
  return value;
}

export function hexKey(qOrHex, r) {
  const hex = typeof qOrHex === "object" ? qOrHex : { q: qOrHex, r };
  assertAxialCoordinate(hex);
  return `${hex.q},${hex.r}`;
}

export function parseHexKey(key) {
  if (typeof key !== "string") throw new TypeError("hex key must be a string");
  const [rawQ, rawR, extra] = key.split(",");
  if (extra !== undefined || !INTEGER_COORDINATE.test(rawQ ?? "") || !INTEGER_COORDINATE.test(rawR ?? "")) {
    throw new TypeError(`invalid hex key: ${key}`);
  }
  return { q: Number(rawQ), r: Number(rawR) };
}

export function cubeCoordinate(hex) {
  assertAxialCoordinate(hex);
  return { q: hex.q, r: hex.r, s: -hex.q - hex.r };
}

export function neighborInDirection(hex, direction) {
  assertAxialCoordinate(hex);
  const delta = HEX_DIRECTIONS[direction];
  if (!delta) throw new TypeError(`unknown hex direction: ${direction}`);
  return { q: hex.q + delta.q, r: hex.r + delta.r };
}

export function hexNeighbors(hex) {
  return HEX_DIRECTION_ORDER.map((direction) => neighborInDirection(hex, direction));
}

export function hexDistance(left, right) {
  const a = cubeCoordinate(left);
  const b = cubeCoordinate(right);
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

export function areHexAdjacent(left, right) {
  return hexDistance(left, right) === 1;
}

export function compareHexes(left, right) {
  assertAxialCoordinate(left, "left hex");
  assertAxialCoordinate(right, "right hex");
  return left.q - right.q || left.r - right.r;
}
