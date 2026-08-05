const RESOURCE_KEYS = Object.freeze(["gold", "supply", "materials", "octarina"]);
const PROJECT_TYPES = new Set(["outpost", "road", "octarina-structure"]);

function normalizeResources(raw = {}) {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, Math.max(0, Number(raw[key] ?? 0))]));
}

export class EconomyState {
  constructor({ stock = {}, income = {}, maintenance = {}, projects = [] } = {}) {
    this.stock = normalizeResources(stock);
    this.income = normalizeResources(income);
    this.maintenance = normalizeResources(maintenance);
    this.projects = projects.map((project) => ({ ...project }));
  }

  canAfford(cost = {}) {
    const normalized = normalizeResources(cost);
    return RESOURCE_KEYS.every((key) => this.stock[key] >= normalized[key]);
  }

  spend(cost = {}) {
    const normalized = normalizeResources(cost);
    if (!this.canAfford(normalized)) throw new TypeError("insufficient resources");
    for (const key of RESOURCE_KEYS) this.stock[key] -= normalized[key];
    return this.snapshot();
  }

  startProject(raw) {
    const type = String(raw?.type ?? "");
    if (!PROJECT_TYPES.has(type)) throw new TypeError(`invalid project type: ${type}`);
    const duration = Math.max(1, Number(raw.turns ?? 1));
    const project = {
      id: String(raw.id), type, hexId: String(raw.hexId),
      cost: normalizeResources(raw.cost), turnsRemaining: duration, state: "building",
    };
    if (!project.id || !project.hexId) throw new TypeError("project requires id and hexId");
    if (this.projects.some((item) => item.id === project.id)) throw new TypeError(`duplicate project: ${project.id}`);
    this.spend(project.cost);
    this.projects.push(project);
    return { ...project, cost: { ...project.cost } };
  }

  advanceTurn() {
    const delta = {};
    for (const key of RESOURCE_KEYS) {
      delta[key] = this.income[key] - this.maintenance[key];
      this.stock[key] = Math.max(0, this.stock[key] + delta[key]);
    }
    const completed = [];
    this.projects = this.projects.map((project) => {
      if (project.state !== "building") return project;
      const turnsRemaining = Math.max(0, project.turnsRemaining - 1);
      const next = { ...project, turnsRemaining, state: turnsRemaining === 0 ? "complete" : "building" };
      if (next.state === "complete") completed.push(next.id);
      return next;
    });
    return { delta, completed, stock: { ...this.stock } };
  }

  setIncomeForMine({ connected, materials = 5 }) {
    this.income.materials = connected ? Math.max(0, Number(materials)) : 0;
  }

  snapshot() {
    return {
      schemaVersion: 1,
      stock: { ...this.stock },
      income: { ...this.income },
      maintenance: { ...this.maintenance },
      projects: this.projects.map((project) => ({ ...project, cost: { ...project.cost } })).sort((a,b) => a.id.localeCompare(b.id)),
    };
  }
}

export function constructionEligibility({ terrain, ownerFactionId, factionId, occupied = false, type }) {
  if (occupied || ownerFactionId !== factionId) return { allowed: false, reason: "hex-unavailable" };
  if (type === "outpost") return { allowed: terrain !== "water", reason: terrain === "water" ? "invalid-terrain" : null };
  if (type === "road") return { allowed: terrain !== "water" && terrain !== "mountain", reason: terrain === "water" || terrain === "mountain" ? "invalid-terrain" : null };
  if (type === "octarina-structure") return { allowed: terrain !== "water", reason: terrain === "water" ? "invalid-terrain" : null };
  return { allowed: false, reason: "unknown-project" };
}
