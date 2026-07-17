from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .cards import Card
from .models import Player, Province, Unit


@dataclass
class GameState:
    size: int
    players: List[Player]
    edges: Dict[Tuple[Tuple[int, int], Tuple[int, int]], str] = field(default_factory=dict)
    provinces: List[Province] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.size <= 0:
            raise ValueError("size must be positive")
        if len(self.players) < 2:
            raise ValueError("at least two players are required")

    def get_player(self, player_name: str) -> Player:
        for player in self.players:
            if player.name == player_name:
                return player
        raise ValueError(f"unknown player: {player_name}")

    def play_edge(self, player_name: str, start: Tuple[int, int], end: Tuple[int, int]) -> None:
        if player_name not in {player.name for player in self.players}:
            raise ValueError(f"unknown player: {player_name}")

        key = tuple(sorted((start, end)))
        self.edges[key] = player_name
        self._resolve_provinces()

    def play_card(self, player_name: str, card: Card, province_index: int) -> bool:
        player = self.get_player(player_name)
        if player.mana < card.cost:
            raise ValueError("not enough mana to play this card")

        if not 0 <= province_index < len(self.provinces):
            raise ValueError("province index is out of range")

        province = self.provinces[province_index]
        if province.owner != player_name:
            raise ValueError("province does not belong to the player")

        player.mana -= card.cost
        if card.effect == "evolve":
            province.unit.level += 1
            province.unit.hp += 2
            return True

        raise ValueError(f"unsupported card effect: {card.effect}")

    def capture_surrounded_provinces(self) -> None:
        if not self.provinces:
            return

        for province in list(self.provinces):
            neighbors = [
                other
                for other in self.provinces
                if other is not province and self._are_adjacent(province, other)
            ]
            if not neighbors:
                continue

            enemy_owners = {neighbor.owner for neighbor in neighbors if neighbor.owner != province.owner}
            if len(enemy_owners) == 1 and not any(neighbor.owner == province.owner for neighbor in neighbors):
                province.owner = next(iter(enemy_owners))

    def _resolve_provinces(self) -> None:
        self.provinces = []
        for y in range(self.size):
            for x in range(self.size):
                cell = (x, y)
                if self._is_closed_cell(cell):
                    owner = self._owner_of_cell(cell)
                    if owner is not None:
                        self.provinces.append(
                            Province(
                                owner=owner,
                                cells=[cell],
                                unit=Unit(kind="recruit", level=1, hp=3),
                            )
                        )

    def _is_closed_cell(self, cell: Tuple[int, int]) -> bool:
        x, y = cell
        if x + 1 >= self.size or y + 1 >= self.size:
            return False
        corners = [
            (x, y),
            (x + 1, y),
            (x, y + 1),
            (x + 1, y + 1),
        ]
        edges = [
            ((x, y), (x + 1, y)),
            ((x + 1, y), (x + 1, y + 1)),
            ((x, y + 1), (x + 1, y + 1)),
            ((x, y), (x, y + 1)),
        ]
        return all(tuple(sorted(edge)) in self.edges for edge in edges)

    def _owner_of_cell(self, cell: Tuple[int, int]) -> Optional[str]:
        x, y = cell
        edges = [
            ((x, y), (x + 1, y)),
            ((x + 1, y), (x + 1, y + 1)),
            ((x, y + 1), (x + 1, y + 1)),
            ((x, y), (x, y + 1)),
        ]
        owners = {self.edges[tuple(sorted(edge))] for edge in edges if tuple(sorted(edge)) in self.edges}
        if len(owners) == 1:
            return next(iter(owners))
        return None

    def _are_adjacent(self, first: Province, second: Province) -> bool:
        for first_cell in first.cells:
            for second_cell in second.cells:
                if abs(first_cell[0] - second_cell[0]) + abs(first_cell[1] - second_cell[1]) == 1:
                    return True
        return False
