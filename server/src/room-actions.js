import { getCard, removeCards } from "./cards.js";
import { createDuel, resolveDuelRound, submitDuelCards } from "./duel-engine.js";
import { ProtocolError } from "./protocol.js";

export class RoomActions {
  applyCommand(command) {
    const { payload } = command;
    const player = this.authenticate(payload.playerId, payload.sessionToken);
    this.assertRevision(payload.expectedRevision);
    if (this.status === "finished") throw new ProtocolError("MATCH_FINISHED", "this match has already finished");

    switch (command.type) {
      case "action.play_edge":
        return this.playEdge(player, payload.start, payload.end);
      case "action.play_card":
        return this.playCard(player, payload);
      case "action.resolve_duel_round":
        return this.submitDuelRound(player, payload.duelId, payload.cardIds);
      case "match.forfeit":
        return this.forfeitMatch(player);
      default:
        throw new ProtocolError("UNKNOWN_COMMAND", `unsupported room command: ${command.type}`);
    }
  }

  playEdge(player, start, end) {
    const result = this.board.playEdge(player.id, start, end);
    const automaticDuelIds = this.openAutomaticSieges();
    if (result.turnChanged) this.regenerateActivePlayer();
    return this.commit("edge.played", {
      playerId: player.id,
      edge: result.edge,
      claimedProvinceIds: result.claimed,
      automaticDuelIds,
      turnChanged: result.turnChanged,
      turnNumber: result.turnNumber,
      currentPlayerId: result.currentPlayerId,
      actionsRemaining: result.actionsRemaining,
    });
  }

  playCard(player, payload) {
    this.board.validateActor(player.id);
    const turnKey = `${this.board.turnNumber}:${player.id}`;
    if (this.usedMacroTurns.has(turnKey)) {
      throw new ProtocolError("CARD_ACTION_USED", "the macro card action for this turn was already used");
    }

    const card = getCard(payload.cardId);
    if (card.kind !== "macro") throw new ProtocolError("INVALID_MACRO_CARD", "only macro cards can be played on the board");
    if (!player.hand.includes(card.id)) throw new ProtocolError("CARD_NOT_IN_HAND", "card is unavailable in the player's hand");
    if (player.mana < card.cost) throw new ProtocolError("NOT_ENOUGH_MANA", "not enough mana to play this card");

    let actionResult;
    if (card.effect === "conquest") {
      if (!payload.start || !payload.end) throw new ProtocolError("MISSING_TARGET", "expansion requires start and end coordinates");
      this.board.validateEdge(payload.start, payload.end);
      actionResult = this.board.playEdge(player.id, payload.start, payload.end, { consumeAction: false });
      actionResult.automaticDuelIds = this.openAutomaticSieges();
    } else if (card.effect === "fortify") {
      if (!payload.provinceId) throw new ProtocolError("MISSING_TARGET", "fortify requires provinceId");
      actionResult = { province: this.board.fortifyProvince(payload.provinceId, player.id, card.value) };
    } else if (card.effect === "duel") {
      if (!payload.provinceId) throw new ProtocolError("MISSING_TARGET", "duel requires provinceId");
      actionResult = { duelId: this.openProvinceDuel(player.id, payload.provinceId, "card").id };
    } else {
      throw new ProtocolError("UNSUPPORTED_CARD", `macro effect not implemented: ${card.effect}`);
    }

    player.hand = removeCards(player.hand, [card.id]);
    player.mana -= card.cost;
    this.usedMacroTurns.add(turnKey);
    return this.commit("card.played", { playerId: player.id, cardId: card.id, actionResult });
  }

  openProvinceDuel(attackerId, provinceId, reason = "contact") {
    const province = this.board.getProvince(provinceId);
    if (province.ownerId === attackerId) throw new ProtocolError("INVALID_TARGET", "cannot duel an allied province");
    const existing = [...this.duels.values()].find((item) => item.provinceId === province.id && item.status !== "resolved");
    if (existing) {
      if (reason === "surround") return existing;
      throw new ProtocolError("DUEL_EXISTS", "this province already has an active duel");
    }
    const duel = createDuel({
      id: `duel-${this.nextDuelId++}`,
      attackerId,
      defenderId: province.ownerId,
      provinceId: province.id,
      reason,
      attackerSupport: this.provinceSupport(attackerId, province),
      defenderSupport: Math.max(0, province.cellIds.length - 1),
      defenderUnit: province.unit,
    });
    this.duels.set(duel.id, duel);
    return duel;
  }

  openAutomaticSieges() {
    const opened = [];
    for (const candidate of this.board.detectSurroundedProvinces()) {
      const province = this.board.getProvince(candidate.provinceId);
      const existing = [...this.duels.values()].find((item) => item.provinceId === province.id && item.status !== "resolved");
      if (existing) continue;
      opened.push(this.openProvinceDuel(candidate.attackerId, candidate.provinceId, "surround").id);
    }
    return opened;
  }

  provinceSupport(playerId, province) {
    const adjacent = new Set();
    for (const cellId of province.cellIds) {
      const cell = this.board.cells.get(cellId.slice(5));
      if (!cell) continue;
      for (const neighbor of this.board.adjacentCells([cell.x, cell.y])) {
        const neighborCell = this.board.cells.get(`${neighbor[0]},${neighbor[1]}`);
        if (neighborCell?.ownerId === playerId) adjacent.add(neighborCell.id);
      }
    }
    return adjacent.size;
  }

  submitDuelRound(player, duelId, cardIds) {
    const duel = this.duels.get(duelId);
    if (!duel) throw new ProtocolError("DUEL_NOT_FOUND", "duel does not exist");
    const ready = submitDuelCards({ duel, player, cardIds });
    let resolution = { resolved: false, winnerId: null };
    let mergedProvinceId = null;
    let automaticDuelIds = [];
    if (ready) {
      resolution = resolveDuelRound(duel);
      if (resolution.resolved && resolution.winnerId === duel.attackerId) {
        const survivorHp = duel.combatants[duel.attackerId].hp;
        const captured = this.board.captureProvince(duel.provinceId, duel.attackerId, Math.ceil(survivorHp / 2));
        mergedProvinceId = captured.id;
        automaticDuelIds = this.openAutomaticSieges();
      }
    }
    return this.commit(ready ? "duel.round_resolved" : "duel.cards_submitted", {
      duelId, playerId: player.id, ready, resolution, mergedProvinceId, automaticDuelIds,
    });
  }

  forfeitMatch(player) {
    return this.forfeitPlayer(player.id, "forfeit");
  }

  forfeitPlayer(playerId, reason = "abandonment", { disconnect = reason === "abandonment" } = {}) {
    if (this.status !== "active" || this.players.length !== 2) {
      throw new ProtocolError("MATCH_NOT_ACTIVE", "a two-player active match is required");
    }
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new ProtocolError("PLAYER_NOT_FOUND", "player does not exist in this room");
    const winner = this.players.find((candidate) => candidate.id !== player.id);
    if (disconnect) {
      player.connected = false;
      player.lastSeenAt = this.clock();
    }
    this.status = "finished";
    this.matchResult = {
      roomId: this.id,
      winnerPlayerId: winner.id,
      loserPlayerId: player.id,
      winnerAccountId: winner.accountId ?? null,
      loserAccountId: player.accountId ?? null,
      reason,
      finishedAt: this.clock(),
    };
    return this.commit("match.finished", {
      winnerPlayerId: winner.id,
      loserPlayerId: player.id,
      reason: this.matchResult.reason,
    });
  }

  regenerateActivePlayer() {
    const active = this.players.find((player) => player.id === this.board.currentPlayerId);
    if (active) active.mana = Math.min(10, active.mana + 1);
  }
}
