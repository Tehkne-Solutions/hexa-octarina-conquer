from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class Card:
    name: str
    cost: int
    effect: str
    value: int = 0
    description: str = ""
    target: str = "province"
    target_edge: Optional[Tuple[Tuple[int, int], Tuple[int, int]]] = None

    def is_playable(self, available_mana: int) -> bool:
        return available_mana >= self.cost
