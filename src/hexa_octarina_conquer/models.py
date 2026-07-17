from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass
class Unit:
    kind: str = "recruit"
    level: int = 1
    hp: int = 3


@dataclass
class Province:
    owner: str
    cells: List[Tuple[int, int]]
    unit: Unit = field(default_factory=Unit)


@dataclass
class Player:
    name: str
    mana: int = 3
    hp: int = 20
