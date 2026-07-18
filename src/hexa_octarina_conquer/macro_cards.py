from __future__ import annotations

from typing import Dict, Optional

from .board_geometry import Point
from .cards import Card
from .models import Player


class MacroCardMixin:
    def play_card(
        self, player_name: str, card: Card, province_index: Optional[int] = None,
        target_player_name: Optional[str] = None, start: Optional[Point] = None,
        end: Optional[Point] = None,
    ) -> bool:
        player = self._ensure_actor(player_name)
        self._validate_card_play(player, card, province_index, target_player_name, start, end)
        if self.started:
            if self.card_actions_remaining <= 0:
                raise ValueError("no card actions remaining")
            self.card_actions_remaining -= 1
        player.hand.remove(card)
        player.mana -= card.cost
        province = self.provinces[province_index or 0] if province_index is not None else None

        if card.effect == "evolve":
            province.unit.level += max(1, card.value)
            province.unit.hp += 2
        elif card.effect == "attack":
            if province_index is not None:
                self._attack_province(player_name, province_index, card.value)
            else:
                target = self.get_player(target_player_name or "")
                target.hp = max(0, target.hp - card.value)
        elif card.effect == "duel":
            self.open_duel(player_name, province_index or 0, reason="card")
        elif card.effect == "fortify":
            province.unit.hp += card.value
            if province.unit.hp >= 6 and province.unit.kind != "fortress":
                province.unit.kind = "fortress"
                province.unit.level += 1
        elif card.effect == "support":
            for other in self.provinces:
                if other.owner == player_name and other is not province and self._are_adjacent(province, other):
                    other.unit.hp += card.value
        elif card.effect == "pressure":
            for other in self.provinces:
                if other.owner != player_name and self._are_adjacent(province, other):
                    other.unit.hp = max(0, other.unit.hp - card.value)
        elif card.effect == "influence":
            for other in self._connected_allied_provinces(province):
                other.unit.hp += card.value
        elif card.effect == "tempo":
            province.unit.hp += card.value
            province.tempo_bonus = max(province.tempo_bonus, card.value)
            province.protected_turns = max(province.protected_turns, 1)
        elif card.effect == "conquest":
            self.play_edge(player_name, start, end, consume_action=False)
        elif card.effect == "trap":
            province.protected_turns = max(province.protected_turns, card.value)
        elif card.effect == "advance_era":
            self.advance_era(player_name)
        elif card.effect == "resource":
            player.resources[card.target] = player.resources.get(card.target, 0) + card.value
        else:
            raise ValueError(f"unsupported macro card effect: {card.effect}")
        self._emit("card_played", player_name, card=card.name, effect=card.effect)
        return True

    def _validate_card_play(self, player: Player, card: Card, province_index, target_name, start, end) -> None:
        if card not in player.hand:
            raise ValueError("card is not in the player's hand")
        if not card.is_playable(player.mana):
            raise ValueError("not enough mana to play this card")
        province_effects = {"evolve", "duel", "fortify", "support", "pressure", "influence", "tempo", "trap"}
        if card.effect in province_effects:
            if province_index is None or not 0 <= province_index < len(self.provinces):
                raise ValueError("valid province index is required")
            province = self.provinces[province_index]
            if card.effect == "duel" and province.owner == player.name:
                raise ValueError("cannot duel your own province")
            if card.effect != "duel" and province.owner != player.name:
                raise ValueError("province does not belong to the player")
        if card.effect == "attack":
            if province_index is None and not target_name:
                raise ValueError("attack cards require a province or player target")
            if province_index is not None and not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            if target_name:
                self.get_player(target_name)
        if card.effect == "conquest":
            if start is None or end is None:
                raise ValueError("conquest cards require start and end coordinates")
            if self._validate_edge(start, end) in self.edges:
                raise ValueError("edge already exists")
        if card.effect == "advance_era" and not self.can_advance_era(player.name):
            raise ValueError("not enough resources to advance era")
        if card.effect in {"shield", "heal", "status"}:
            raise ValueError("duel cards can only be used inside a duel")

    def _attack_province(self, attacker_name: str, province_index: int, damage: int) -> None:
        province = self.provinces[province_index]
        if province.owner == attacker_name:
            raise ValueError("cannot attack your own province")
        if province.protected_turns > 0:
            return
        province.unit.hp = max(0, province.unit.hp - damage)
        if province.unit.hp == 0:
            self.open_duel(attacker_name, province_index, reason="assault")

    def era_upgrade_cost(self, player: Player) -> Dict[str, int]:
        if player.era_level == 1:
            return {"wood": 2, "food": 1, "knowledge": 1}
        if player.era_level == 2:
            return {"wood": 3, "stone": 2, "knowledge": 2}
        return {"wood": 4, "stone": 4, "food": 2, "knowledge": 3}

    def can_advance_era(self, player_name: str) -> bool:
        player = self.get_player(player_name)
        if player.era_level >= 3:
            return False
        return all(player.resources.get(key, 0) >= value for key, value in self.era_upgrade_cost(player).items())

    def advance_era(self, player_name: str) -> bool:
        player = self.get_player(player_name)
        if player.era_level >= 3:
            raise ValueError("player is already at maximum era")
        if not self.can_advance_era(player_name):
            raise ValueError("not enough resources to advance era")
        for resource, amount in self.era_upgrade_cost(player).items():
            player.resources[resource] -= amount
        player.era_level += 1
        player.mana_regen_bonus += 1
        for province in self.provinces:
            if province.owner == player_name:
                province.unit.hp += 1
        self._emit("era_advanced", player_name, era=player.era_level)
        return True
