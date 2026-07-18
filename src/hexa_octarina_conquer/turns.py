from __future__ import annotations

from .models import Player


class TurnMixin:
    def draw_card(self, player: Player) -> bool:
        if len(player.hand) >= self.max_hand_size or not player.deck:
            return False
        player.hand.append(player.deck.pop(0))
        return True

    def start_turn(self) -> None:
        if self.is_game_over():
            return
        player = self.current_player()
        player.mana += self.mana_regen + player.mana_regen_bonus
        self.collect_resources(player)
        self.draw_card(player)
        self.actions_remaining = {1: 1, 2: 2, 3: 2}.get(player.era_level, 2)
        self.card_actions_remaining = 1 if player.era_level < 3 else 2
        self.started = True
        self._emit("turn_started", player.name, turn=self.turn_number)

    def end_turn(self) -> None:
        if not self.started:
            raise ValueError("turn has not started")
        previous = self.current_player().name
        self._tick_province_effects()
        self.current_player_index = (self.current_player_index + 1) % len(self.players)
        self.turn_number += 1
        self.started = False
        self._emit("turn_ended", previous, turn=self.turn_number - 1)
        self.start_turn()

    def _tick_province_effects(self) -> None:
        for province in self.provinces:
            if province.protected_turns > 0:
                province.protected_turns -= 1
            if province.protected_turns == 0 and province.tempo_bonus > 0:
                province.unit.hp += 1
                province.tempo_bonus -= 1

    def _ensure_actor(self, player_name: str) -> Player:
        player = self.get_player(player_name)
        if self.started and self.current_player().name != player_name:
            raise ValueError("it is not this player's turn")
        return player
