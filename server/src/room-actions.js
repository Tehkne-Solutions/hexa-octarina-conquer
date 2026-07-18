import { getCard, removeCards } from "./cards.js";
import { createDuel, resolveDuelRound, submitDuelCards } from "./duel-engine.js";
import { ProtocolError } from "./protocol.js";

export class RoomActions {
  applyCommand(command) {
    const { payload } = command;
    const player = this.authenticate(payload.playerId, payload.sessionToken);
    this.assertRevision(payload.expectedRevision);

    switch (command.type) {
      case "action.play_edge":
        return this.playEdge(player, payload.start, payload.end);
      case "action.play_card":
        return this.playCard(player, payload);
      case "action.resolve_duel_round":
        return this.submitDuelRound(player, payload.duelId, payload.cardIds);
      default:
        throw new ProtocolError("UNKNOWN_COMMAND", `unsupported room command: ${command.type}`);
    }
  }

  playEdge(player, start, end) {
    const result = this.board.playEdge(player.id, start, end);
    if (result.turnChanged) this.regenerateActivePlayer();
    return this.commit("edge.played", {
      playerId: player.id,
      edge: result.edge,
      claimedProvinceIds: result.claimed,
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
      if (!payload.start || !payload.end) {
        throw new ProtocolError("MISSING_TARGET", "expansion requires start and end coordinates");
      }
      this.board.validateEdge(payload.start, payload.end);
      actionResult = this.board.playEdge(player.id, payload.start, payload.end, { consumeAction: false });
    } else if (card.effect === "fortify") {
      if (!payload.provinceId) throw new ProtocolError("MISSING_TARGET", "fortify requires provinceId");
      actionResult = { province: this.board.fortifyProvince(payload.provinceId, player.id, card.value) };
    } else if (card.effect === "duel") {
      if (!payload.provinceId) throw new ProtocolError("MISSING_TARGET", "duel requires provinceId");
      const province = this.board.getProvince(payload.provinceId);
      if (province.ownerId === player.id) throw new ProtocolError("INVALID_TARGET", "cannot duel an allied province");
      const existing = [...this.duels.values()].find((item) => item.provinceId === province.id && item.status !== "resolved");
      if (existing) throw new ProtocolError("DUEL_EXISTS", "this province already has an active duel");
      const duel = createDuel({
        id: `duel-${this.nextDuelId++}`,
        attackerId: player.id,
        defenderId: province.ownerId,
        provinceId: province.id,
      });
      this.duels.set(duel.id, duel);
      actionResult = { duelId: duel.id };
    } else {
      throw new ProtocolError("UNSUPPORTED_CARD", `macro effect not implemented: ${card.effect}`);
    }

    player.hand = removeCards(player.hand, [card.id]);
    player.mana -= card.cost;
    this.usedMacroTurns.add(turnKey);

    return this.commit("card.played", {
      playerId: player.id,
      cardId: card.id,
      actionResult,
    });
  }

  submitDuelRound(player, duelId, cardIds) {
    const duel = this.duels.get(duelId);
    if (!duel) throw new ProtocolError("DUEL_NOT_FOUND", "duel does not exist");

    const ready = submitDuelCards({ duel, player, cardIds });
    let resolution = { resolved: false, winnerId: null };
    if (ready) {
      resolution = resolveDuelRound(duel);
      if (resolution.resolved && resolution.winnerId === duel.attackerId) {
        const survivorHp = duel.combatants[duel.attackerId].hp;
        this.board.captureProvince(duel.provinceId, duel.attackerId, Math.ceil(survivorHp / 2));
      }
    }

    return this.commit(ready ? "duel.round_resolved" : "duel.cards_submitted", {
      duelId,
      playerId: player.id,
      ready,
      resolution,
    });
  }

  regenerateActivePlayer() {
    const active = this.players.find((player) => player.id === this.board.currentPlayerId);
    if (active) active.mana = Math.min(10, active.mana + 1);
  }
}
