from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .board import BoardMixin, Cell, Edge
from .duels import DuelMixin
from .macro_cards import MacroCardMixin
from .models import Duel, GameEvent, Player, Province
from .state_view import StateViewMixin
from .turns import TurnMixin


@dataclass
class GameState(BoardMixin, DuelMixin, MacroCardMixin, StateViewMixin, TurnMixin):
    """Authoritative reference engine for the hybrid Dots/Go/TCG rules."""

    size: int
    players: List[Player]
    edges: Dict[Edge, str] = field(default_factory=dict)
    cell_owners: Dict[Cell, str] = field(default_factory=dict)
    provinces: List[Province] = field(default_factory=list)
    pending_duels: List[Duel] = field(default_factory=list)
    event_log: List[GameEvent] = field(default_factory=list)
    current_player_index: int = 0
    turn_number: int = 1
    mana_regen: int = 1
    max_hand_size: int = 5
    started: bool = False
    actions_remaining: int = 0
    card_actions_remaining: int = 0
    next_province_id: int = 1
    next_duel_id: int = 1

    def __post_init__(self) -> None:
        if self.size < 2:
            raise ValueError("size must contain at least two points")
        if len(self.players) < 2:
            raise ValueError("at least two players are required")
        names = [player.name for player in self.players]
        if len(names) != len(set(names)):
            raise ValueError("player names must be unique")
