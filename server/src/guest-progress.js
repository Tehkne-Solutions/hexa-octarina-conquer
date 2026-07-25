const STATUS_RANK = Object.freeze({
  "not-started": 0,
  defeat: 1,
  active: 2,
  victory: 3,
});

const ALLOWED_REWARDS = new Set([
  "Arco Prismático",
  "Fazenda Arcana",
  "Torre Rúnica",
]);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalTimestamp(value) {
  const number = finiteNumber(value, 0);
  return number > 0 ? Math.floor(number) : null;
}

function normalizedStatus(value) {
  return Object.hasOwn(STATUS_RANK, value) ? value : "not-started";
}

function normalizeRewards(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((item) => ALLOWED_REWARDS.has(item)))];
}

export function emptyGuestProgress() {
  return {
    schemaVersion: 1,
    missionId: "bridge-of-ashes",
    title: "A Ponte das Cinzas",
    status: "not-started",
    percent: 0,
    completedObjectives: 0,
    totalObjectives: 5,
    attempts: 0,
    bestTurn: null,
    lastTurn: 0,
    startedAt: null,
    lastPlayedAt: null,
    completedAt: null,
    building: null,
    rewards: [],
    updatedAt: 0,
  };
}

export function normalizeGuestProgress(value, now = Date.now()) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = normalizedStatus(input.status);
  const percent = status === "victory"
    ? 100
    : Math.max(0, Math.min(100, Math.round(finiteNumber(input.percent, 0))));
  const completedObjectives = status === "victory"
    ? 5
    : Math.max(0, Math.min(5, Math.floor(finiteNumber(input.completedObjectives, 0))));
  const bestTurnValue = Math.floor(finiteNumber(input.bestTurn, 0));
  const building = input.building === "farm" || input.building === "tower" ? input.building : null;
  const rewards = normalizeRewards(input.rewards);
  if (status === "victory" && !rewards.includes("Arco Prismático")) rewards.push("Arco Prismático");
  if (building === "farm" && !rewards.includes("Fazenda Arcana")) rewards.push("Fazenda Arcana");
  if (building === "tower" && !rewards.includes("Torre Rúnica")) rewards.push("Torre Rúnica");

  const hasActivity = status !== "not-started"
    || percent > 0
    || completedObjectives > 0
    || finiteNumber(input.attempts, 0) > 0;

  return {
    schemaVersion: 1,
    missionId: "bridge-of-ashes",
    title: "A Ponte das Cinzas",
    status,
    percent,
    completedObjectives,
    totalObjectives: 5,
    attempts: Math.max(0, Math.min(10_000, Math.floor(finiteNumber(input.attempts, 0)))),
    bestTurn: bestTurnValue > 0 ? bestTurnValue : null,
    lastTurn: Math.max(0, Math.min(10_000, Math.floor(finiteNumber(input.lastTurn, 0)))),
    startedAt: optionalTimestamp(input.startedAt),
    lastPlayedAt: optionalTimestamp(input.lastPlayedAt),
    completedAt: status === "victory" ? optionalTimestamp(input.completedAt) ?? Math.floor(now) : null,
    building,
    rewards,
    updatedAt: hasActivity ? Math.max(optionalTimestamp(input.updatedAt) ?? 0, optionalTimestamp(input.lastPlayedAt) ?? 0, 1) : 0,
  };
}

export function guestProgressHasActivity(value) {
  const progress = normalizeGuestProgress(value);
  return progress.status !== "not-started"
    || progress.percent > 0
    || progress.completedObjectives > 0
    || progress.attempts > 0;
}

function rewardSubset(left, right) {
  const rightSet = new Set(right.rewards);
  return left.rewards.every((reward) => rightSet.has(reward));
}

function progressDominates(left, right) {
  return STATUS_RANK[left.status] >= STATUS_RANK[right.status]
    && left.percent >= right.percent
    && left.completedObjectives >= right.completedObjectives
    && left.attempts >= right.attempts
    && rewardSubset(right, left)
    && (!right.building || left.building === right.building);
}

function equivalent(left, right) {
  return progressDominates(left, right)
    && progressDominates(right, left)
    && left.bestTurn === right.bestTurn
    && left.lastTurn === right.lastTurn;
}

export function compareGuestProgress(localValue, remoteValue) {
  const local = normalizeGuestProgress(localValue);
  const remote = normalizeGuestProgress(remoteValue);
  if (equivalent(local, remote)) return { relation: "equal", local, remote };
  const localActive = guestProgressHasActivity(local);
  const remoteActive = guestProgressHasActivity(remote);
  if (localActive && !remoteActive) return { relation: "local-ahead", local, remote };
  if (remoteActive && !localActive) return { relation: "remote-ahead", local, remote };
  if (progressDominates(local, remote)) return { relation: "local-ahead", local, remote };
  if (progressDominates(remote, local)) return { relation: "remote-ahead", local, remote };
  return { relation: "conflict", local, remote };
}

function earlierTimestamp(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  return Math.min(left, right);
}

function laterTimestamp(left, right) {
  return Math.max(left ?? 0, right ?? 0) || null;
}

function betterTurn(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  return Math.min(left, right);
}

export function mergeGuestProgress(localValue, remoteValue, now = Date.now()) {
  const local = normalizeGuestProgress(localValue, now);
  const remote = normalizeGuestProgress(remoteValue, now);
  const localRank = STATUS_RANK[local.status];
  const remoteRank = STATUS_RANK[remote.status];
  const preferred = localRank > remoteRank
    ? local
    : remoteRank > localRank
      ? remote
      : local.percent >= remote.percent
        ? local
        : remote;
  const status = localRank >= remoteRank ? local.status : remote.status;
  const percent = status === "victory" ? 100 : Math.max(local.percent, remote.percent);
  const completedObjectives = status === "victory" ? 5 : Math.max(local.completedObjectives, remote.completedObjectives);
  return normalizeGuestProgress({
    ...preferred,
    status,
    percent,
    completedObjectives,
    attempts: Math.max(local.attempts, remote.attempts),
    bestTurn: betterTurn(local.bestTurn, remote.bestTurn),
    lastTurn: Math.max(local.lastTurn, remote.lastTurn),
    startedAt: earlierTimestamp(local.startedAt, remote.startedAt),
    lastPlayedAt: laterTimestamp(local.lastPlayedAt, remote.lastPlayedAt),
    completedAt: status === "victory" ? earlierTimestamp(local.completedAt, remote.completedAt) ?? now : null,
    building: preferred.building ?? local.building ?? remote.building,
    rewards: [...new Set([...remote.rewards, ...local.rewards])],
    updatedAt: now,
  }, now);
}

export function resolveGuestProgress(localValue, remoteValue, strategy = "merge", now = Date.now()) {
  const comparison = compareGuestProgress(localValue, remoteValue);
  if (strategy === "preview") return { ...comparison, strategy, resolved: comparison.remote, changed: false };
  if (strategy === "remote") return { ...comparison, strategy, resolved: comparison.remote, changed: false };
  const resolved = strategy === "local"
    ? normalizeGuestProgress(comparison.local, now)
    : mergeGuestProgress(comparison.local, comparison.remote, now);
  const changed = !equivalent(resolved, comparison.remote);
  return { ...comparison, strategy: strategy === "local" ? "local" : "merge", resolved, changed };
}
