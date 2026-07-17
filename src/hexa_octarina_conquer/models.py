from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from .cards import Card


@dataclass
class Unit:
    kind: str = "recruit"
    level: int = 1
    hp: int = 3


@dataclass
class Province:
    owner: str
    cells: List[Tuple[int, int]]
    resource_type: str = "wood"
    unit: Unit = field(default_factory=Unit)
    protected_turns: int = 0
    tempo_bonus: int = 0


@dataclass
class Player:
    name: str
    mana: int = 3
    hp: int = 20
    resources: Dict[str, int] = field(default_factory=lambda: {"wood": 0, "stone": 0, "food": 0, "knowledge": 0})
    deck: List[Card] = field(default_factory=list)
    hand: List[Card] = field(default_factory=list)
    era_level: int = 1
    mana_regen_bonus: int = 0

    @property
    def era_name(self) -> str:
        names = {1: "Antiga", 2: "Medieval", 3: "Magitech"}
        return names.get(self.era_level, "Avançada")
