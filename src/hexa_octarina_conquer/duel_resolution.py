from __future__ import annotations

from typing import List

from .cards import Card
from .combat import resolve_round, validate_sequence
from .models import Duel, DuelCombatant, Unit


class DuelResolutionMixin:
    def resolve_duel_round(self, duel_id: str, attacker_cards: List[Card], defender_cards: List[Card]) -> Duel:
        duel = self.get_duel(duel_id)
        if duel.status == "resolved":
            raise ValueError("duel is already resolved")
        attacker = self.get_player(duel.attacker)
        defender = self.get_player(duel.defender)
        self._validate_combat_hand(attacker, attacker_cards, duel.attacker_state)
        self._validate_combat_hand(defender, defender_cards, duel.defender_state)
        for card in attacker_cards:
            attacker.hand.remove(card)
        for card in defender_cards:
            defender.hand.remove(card)
        initiative = (
            attacker.era_level + duel.attacker_state.support_bonus
            >= defender.era_level + duel.defender_state.support_bonus
        )
        duel.status = "active"
        result = resolve_round(
            duel.attacker_state, duel.defender_state,
            attacker_cards, defender_cards, initiative,
        )
        duel.log.extend(result.log)
        self._emit("duel_round", result.first_actor, duel_id=duel.id, round=duel.round_number)
        attacker_dead = duel.attacker_state.hp <= 0
        defender_dead = duel.defender_state.hp <= 0
        if attacker_dead or defender_dead:
            winner = duel.defender if attacker_dead else duel.attacker
            if attacker_dead and defender_dead:
                winner = duel.defender
            self._finish_duel(duel, winner)
        else:
            duel.round_number += 1
            duel.attacker_state.energy = min(7, duel.attacker_state.energy + 1)
            duel.defender_state.energy = min(7, duel.defender_state.energy + 1)
        return duel

    def _validate_combat_hand(self, player, cards: List[Card], state: DuelCombatant) -> None:
        remaining = list(player.hand)
        for card in cards:
            if card not in remaining:
                raise ValueError(f"{card.name} is not available in {player.name}'s hand")
            remaining.remove(card)
            if card.effect not in {"attack", "shield", "heal", "status"}:
                raise ValueError("only duel cards can be used in combat")
        validate_sequence(state, cards)

    def _finish_duel(self, duel: Duel, winner: str) -> None:
        duel.status = "resolved"
        duel.winner = winner
        province = self._province_by_id(duel.province_id)
        if winner == duel.attacker:
            province.owner = duel.attacker
            province.unit = Unit(
                kind="recruit",
                level=1,
                hp=max(3, duel.attacker_state.hp // 2),
                element=self.get_player(duel.attacker).faction_element,
            )
            for cell in province.cells:
                self.cell_owners[cell] = duel.attacker
            self._rebuild_provinces()
        else:
            province.unit.hp = max(1, duel.defender_state.hp)
            attacker = self.get_player(duel.attacker)
            attacker.hp = max(0, attacker.hp - 1)
        self._emit("duel_resolved", winner, duel_id=duel.id, province_id=duel.province_id)
