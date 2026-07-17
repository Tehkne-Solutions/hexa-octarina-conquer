from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Card:
    name: str
    cost: int
    effect: str

    def is_playable(self, available_mana: int) -> bool:
        return available_mana >= self.cost
