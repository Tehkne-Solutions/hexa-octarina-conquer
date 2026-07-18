from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

Point = Tuple[int, int]
Edge = Tuple[Point, Point]


@dataclass(frozen=True)
class Card:
    """Data-only card definition shared by the macro board and cell duels."""

    name: str
    cost: int
    effect: str
    value: int = 0
    description: str = ""
    target: str = "province"
    target_edge: Optional[Edge] = None
    element: str = "physical"
    status: str = ""
    duration: int = 0

    def __post_init__(self) -> None:
        if self.cost < 0:
            raise ValueError("card cost cannot be negative")
        if self.value < 0:
            raise ValueError("card value cannot be negative")

    def is_playable(self, available_mana: int) -> bool:
        return available_mana >= self.cost
