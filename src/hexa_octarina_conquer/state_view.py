from __future__ import annotations

from typing import Dict, Optional

from .models import Duel, GameEvent, Player


class StateViewMixin:
    def get_player(self, player_name: str) -> Player:
        for player in self.players:
            if player.name == player_name:
                return player
        raise ValueError(f"unknown player: {player_name}")

    def current_player(self) -> Player:
        return self.players[self.current_player_index]

    def is_game_over(self) -> bool:
        return any(player.hp <= 0 for player in self.players)

    def winner(self) -> Optional[Player]:
        alive = [player for player in self.players if player.hp > 0]
        return alive[0] if len(alive) == 1 else None

    def _emit(self, event_type: str, actor: str, **payload: object) -> None:
        self.event_log.append(GameEvent(event_type, actor, payload))
        self.event_log = self.event_log[-100:]

    def get_state_summary(self) -> Dict[str, object]:
        return {
            "turn": self.turn_number,
            "current_player": self.current_player().name,
            "started": self.started,
            "actions_remaining": self.actions_remaining,
            "card_actions_remaining": self.card_actions_remaining,
            "players": [{
                "name": p.name, "hp": p.hp, "mana": p.mana,
                "era": p.era_level, "era_name": p.era_name,
                "resources": dict(p.resources), "hand_size": len(p.hand),
            } for p in self.players],
            "provinces": [{
                "id": p.id, "owner": p.owner, "cells": list(p.cells),
                "resource": p.resource_type,
                "unit": {"kind": p.unit.kind, "level": p.unit.level, "hp": p.unit.hp, "element": p.unit.element},
                "protected_turns": p.protected_turns, "tempo_bonus": p.tempo_bonus,
            } for p in self.provinces],
            "pending_duels": [self._duel_summary(d) for d in self.pending_duels if d.status != "resolved"],
            "game_over": self.is_game_over(),
            "winner": self.winner().name if self.winner() else None,
            "recent_events": [{"type": e.type, "actor": e.actor, "payload": e.payload} for e in self.event_log[-10:]],
        }

    @staticmethod
    def _duel_summary(duel: Duel) -> Dict[str, object]:
        return {
            "id": duel.id, "attacker": duel.attacker, "defender": duel.defender,
            "province_id": duel.province_id, "reason": duel.reason,
            "status": duel.status, "round": duel.round_number, "winner": duel.winner,
            "attacker_hp": duel.attacker_state.hp, "defender_hp": duel.defender_state.hp,
            "attacker_energy": duel.attacker_state.energy, "defender_energy": duel.defender_state.energy,
        }
