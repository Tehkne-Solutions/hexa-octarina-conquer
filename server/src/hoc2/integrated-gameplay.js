import { ArmyState } from "./army-state.js";
import { createCardCombat, requestRetreat, resolveCardCombatRound, submitCardSequence } from "./card-combat.js";
import { analyzeGoState, retreatLiberties } from "./influence-state.js";
import { hexKey } from "./hex-coordinates.js";

function unitTags(army) {
  return army.units.map((unit) => String(unit.type ?? unit.id ?? unit.name ?? unit).toLowerCase());
}

function combatantFromArmy(army, defaults = {}) {
  return {
    id: army.id,
    commander: army.commanderId ?? army.id,
    hp: defaults.hp ?? 24,
    armyStrength: defaults.armyStrength ?? 30,
    units: unitTags(army),
    deck: defaults.deck,
  };
}

export class Hoc2IntegratedGameplay {
  constructor({ map, armies, strategicNetwork = null, octarinaNetwork = null, supplyNodeByArmy = {}, objective = null, combatStats = {} }) {
    this.map = map;
    this.armies = armies instanceof ArmyState ? armies : new ArmyState(armies);
    this.strategicNetwork = strategicNetwork;
    this.octarinaNetwork = octarinaNetwork;
    this.supplyNodeByArmy = { ...supplyNodeByArmy };
    this.objective = objective ? { ...objective } : null;
    this.combatStats = { ...combatStats };
    this.activeContact = null;
    this.activeCombat = null;
    this.lastCascade = [];
    this.recalculate();
  }

  army(id) { return this.armies.army(id); }

  moveArmy(armyId, destination) {
    if (this.activeCombat) throw new Error("combat must resolve before strategic movement continues");
    const result = this.armies.move(armyId, destination);
    if (result.type === "MOVED") {
      this.syncArmyOccupancy(armyId);
      this.recalculate();
      return { ...result, world: this.snapshot() };
    }
    this.activeContact = result;
    this.activeCombat = this.createCombatFromContact(result);
    return { ...result, combat: this.combatSnapshot() };
  }

  createCombatFromContact(contact) {
    const attacker = this.army(contact.attackerId);
    const defender = this.army(contact.defenderId);
    if (!attacker || !defender) throw new Error("contact armies must exist");
    const attackerRetreatHexes = retreatLiberties(this.map, attacker.factionId, hexKey(attacker)).map((key) => {
      const [q, r] = key.split(",").map(Number); return { q, r };
    });
    const defenderRetreatHexes = retreatLiberties(this.map, defender.factionId, hexKey(defender)).map((key) => {
      const [q, r] = key.split(",").map(Number); return { q, r };
    });
    const attackerResonance = this.octarinaBonusFor(attacker.factionId);
    const defenderResonance = this.octarinaBonusFor(defender.factionId);
    return createCardCombat({
      id: `contact:${attacker.id}:${defender.id}`,
      attacker: combatantFromArmy(attacker, this.combatStats[attacker.id]),
      defender: combatantFromArmy(defender, this.combatStats[defender.id]),
      terrain: this.map.get(contact.hex)?.terrain ?? "plain",
      attackerRetreatHexes,
      defenderRetreatHexes,
      octarinaResonance: { [attacker.id]: attackerResonance, [defender.id]: defenderResonance },
    });
  }

  submitCombatCards(armyId, cardIds) {
    if (!this.activeCombat) throw new Error("no active combat");
    const ready = submitCardSequence(this.activeCombat, armyId, cardIds);
    return { ready, combat: this.combatSnapshot() };
  }

  resolveCombatRound() {
    if (!this.activeCombat) throw new Error("no active combat");
    const result = resolveCardCombatRound(this.activeCombat);
    if (result.status === "resolved") return this.applyCombatResult(result);
    return { type: "COMBAT_ROUND", combat: result };
  }

  retreat(armyId) {
    if (!this.activeCombat) throw new Error("no active combat");
    const result = requestRetreat(this.activeCombat, armyId);
    if (!result.accepted) return { type: "RETREAT_REJECTED", ...result };
    return this.applyCombatResult(result);
  }

  applyCombatResult(result) {
    const contact = this.activeContact;
    if (!contact) throw new Error("combat result has no strategic contact");
    const winner = this.armies.armies.get(result.winnerId);
    const loser = this.armies.armies.get(result.loserId);
    const attackerWon = result.winnerId === contact.attackerId;
    const cascade = [];

    for (const [id, combatant] of Object.entries(result.combatants ?? {})) {
      const army = this.armies.armies.get(id);
      if (!army) continue;
      army.combatHp = combatant.hp;
      army.armyStrength = combatant.armyStrength;
      army.state = id === result.loserId ? "retreating" : "exhausted";
    }

    if (attackerWon) {
      const defenderRetreat = this.activeCombat.retreatHexes[contact.defenderId]?.[0] ?? null;
      if (loser && defenderRetreat && result.resultReason !== "retreat") {
        this.clearArmyFromCell(loser.id, loser);
        loser.q = defenderRetreat.q; loser.r = defenderRetreat.r;
        this.setArmyOnCell(loser.id, loser);
        cascade.push({ type: "ARMY_RETREATED", armyId: loser.id, hex: { ...defenderRetreat } });
      } else if (loser && !defenderRetreat) {
        this.clearArmyFromCell(loser.id, loser);
        this.armies.armies.delete(loser.id);
        cascade.push({ type: "ARMY_REMOVED", armyId: loser.id });
      }
      if (winner) {
        this.clearArmyFromCell(winner.id, winner);
        winner.q = contact.hex.q; winner.r = contact.hex.r; winner.movementRemaining = 0; winner.state = "exhausted";
        this.setArmyOnCell(winner.id, winner, winner.factionId);
        cascade.push({ type: "HEX_CAPTURED", armyId: winner.id, hex: { ...contact.hex }, factionId: winner.factionId });
        this.captureNodeAt(contact.hex, winner.factionId);
      }
    } else if (result.resultReason === "retreat" && result.loserId === contact.defenderId && loser && result.retreatHex) {
      this.clearArmyFromCell(loser.id, loser);
      loser.q = result.retreatHex.q; loser.r = result.retreatHex.r;
      this.setArmyOnCell(loser.id, loser);
      cascade.push({ type: "ARMY_RETREATED", armyId: loser.id, hex: { ...result.retreatHex } });
    }

    this.activeContact = null;
    this.activeCombat = null;
    const recalculated = this.recalculate();
    cascade.push(...recalculated.events);
    this.lastCascade = cascade;
    return { type: "COMBAT_RESULT", result, cascade, world: this.snapshot() };
  }

  clearArmyFromCell(armyId, position) {
    const cell = this.map.get(position);
    if (cell?.armyId === armyId) this.map.updateCell(position, { armyId: null });
  }

  setArmyOnCell(armyId, position, controllerFactionId = undefined) {
    const cell = this.map.get(position);
    if (!cell) return;
    const patch = { armyId };
    if (controllerFactionId !== undefined) patch.controllerFactionId = controllerFactionId;
    this.map.updateCell(position, patch);
  }

  syncArmyOccupancy(armyId) {
    const army = this.army(armyId);
    if (!army) return;
    for (const cell of this.map.orderedCells()) if (cell.armyId === armyId && (cell.q !== army.q || cell.r !== army.r)) this.map.updateCell(cell.id, { armyId: null });
    this.setArmyOnCell(armyId, army, army.factionId);
  }

  captureNodeAt(hex, factionId) {
    const cell = this.map.get(hex);
    if (!cell) return;
    if (cell.strategicNodeId && this.strategicNetwork?.nodes.has(cell.strategicNodeId)) {
      const node = this.strategicNetwork.nodes.get(cell.strategicNodeId);
      this.strategicNetwork.nodes.set(node.id, { ...node, ownerFactionId: factionId, state: "active" });
    }
    if (cell.octarinaNodeId && this.octarinaNetwork?.nodes.has(cell.octarinaNodeId)) {
      const node = this.octarinaNetwork.nodes.get(cell.octarinaNodeId);
      this.octarinaNetwork.nodes.set(node.id, { ...node, ownerFactionId: factionId, state: "active" });
    }
  }

  octarinaBonusFor(factionId) {
    if (!this.octarinaNetwork) return false;
    for (const node of this.octarinaNetwork.nodes.values()) {
      if (node.kind !== "core" || node.ownerFactionId !== factionId) continue;
      if (this.octarinaNetwork.formationProgress(node.id, factionId).resonance) return true;
    }
    return false;
  }

  recalculate() {
    const beforeSupply = Object.fromEntries([...this.armies.armies.values()].map((army) => [army.id, army.supply]));
    const go = analyzeGoState(this.map, [...new Set([...this.armies.armies.values()].map((army) => army.factionId))]);
    const events = [];

    if (this.strategicNetwork) {
      for (const army of this.armies.armies.values()) {
        const nodeId = this.supplyNodeByArmy[army.id];
        if (!nodeId) continue;
        const supplied = Boolean(this.strategicNetwork.supplyPath(nodeId, army.factionId));
        army.supply = supplied ? "supplied" : "cut-off";
        if (beforeSupply[army.id] && beforeSupply[army.id] !== army.supply) events.push({ type: "SUPPLY_CHANGED", armyId: army.id, supply: army.supply });
      }
    }

    const octarina = {};
    if (this.octarinaNetwork) {
      for (const node of this.octarinaNetwork.nodes.values()) {
        if (node.kind !== "core" || !node.ownerFactionId) continue;
        octarina[node.id] = {
          ...this.octarinaNetwork.flowTo(node.id, node.ownerFactionId),
          formation: this.octarinaNetwork.formationProgress(node.id, node.ownerFactionId),
        };
      }
    }

    if (this.objective?.type === "capture" && this.objective.hex) {
      const cell = this.map.get(this.objective.hex);
      const complete = cell?.controllerFactionId === this.objective.factionId;
      if (complete && !this.objective.complete) events.push({ type: "OBJECTIVE_COMPLETE", id: this.objective.id });
      this.objective.complete = complete;
    }

    this.go = go;
    this.octarina = octarina;
    return { go, octarina, events };
  }

  combatSnapshot() {
    if (!this.activeCombat) return null;
    return {
      id: this.activeCombat.id,
      status: this.activeCombat.status,
      round: this.activeCombat.round,
      terrain: this.activeCombat.terrain,
      attackerId: this.activeCombat.attackerId,
      defenderId: this.activeCombat.defenderId,
      combatants: Object.fromEntries(Object.entries(this.activeCombat.combatants).map(([id, state]) => [id, { ...state, statuses: { ...state.statuses }, units: [...state.units] }])),
      hands: Object.fromEntries(Object.entries(this.activeCombat.hands).map(([id, hand]) => [id, [...hand]])),
      intents: { ...this.activeCombat.intents },
      retreatAvailable: Object.fromEntries(Object.keys(this.activeCombat.combatants).map((id) => [id, Boolean(this.activeCombat.retreatHexes[id]?.length)])),
    };
  }

  snapshot() {
    return {
      map: this.map.snapshot(),
      armies: this.armies.snapshot(),
      go: this.go,
      strategicNetwork: this.strategicNetwork?.snapshot() ?? null,
      octarinaNetwork: this.octarinaNetwork?.snapshot() ?? null,
      octarina: this.octarina,
      objective: this.objective ? { ...this.objective } : null,
      activeContact: this.activeContact ? { ...this.activeContact } : null,
      combat: this.combatSnapshot(),
      cascade: [...this.lastCascade],
    };
  }
}
