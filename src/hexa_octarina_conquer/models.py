from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .cards import Card

Point = Tuple[int, int]
Cell = Tuple[int, int]


@dataclass
class Unit:
    kind: str = "recruit"
    level: int = 1
    hp: int = 3
    element: str = "physical"

    @property
    def strength(self) -> int:
        return self.level * 2 + self.hp


@dataclass
class Province:
    owner: str
    cells: List[Cell]
    resource_type: str = "wood"
    unit: Unit = field(default_factory=Unit)
    protected_turns: int = 0
    tempo_bonus: int = 0
    id: str = ""


@dataclass
class Player:
    name: str
    mana: int = 3
    hp: int = 20
    resources: Dict[str, int] = field(
        default_factory=lambda: {"wood": 0, "stone": 0, "food": 0, "knowledge": 0}
    )
    deck: List[Card] = field(default_factory=list)
    hand: List[Card] = field(default_factory=list)
    era_level: int = 1
    mana_regen_bonus: int = 0
    faction_element: str = "physical"

    @property
    def era_name(self) -> str:
        names = {1: "Rúnica", 2: "Alquímica", 3: "Magitech"}
        return names.get(self.era_level, "Avançada")


@dataclass
class DuelCombatant:
    player_name: str
    hp: int
    max_hp: int
    energy: int
    element: str = "physical"
    shield: int = 0
    support_bonus: int = 0
    statuses: Dict[str, int] = field(default_factory=dict)


@dataclass
class Duel:
    id: str
    attacker: str
    defender: str
    province_id: str
    reason: str
    attacker_state: DuelCombatant
    defender_state: DuelCombatant
    status: str = "pending"
    round_number: int = 1
    winner: Optional[str] = None
    log: List[str] = field(default_factory=list)


@dataclass
class GameEvent:
    type: str
    actor: str
    payload: Dict[str, object] = field(default_factory=dict)
