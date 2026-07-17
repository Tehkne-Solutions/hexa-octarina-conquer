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
    current_player_index: int = 0
    turn_number: int = 1
    mana_regen: int = 1
    max_hand_size: int = 5

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

    def current_player(self) -> Player:
        return self.players[self.current_player_index]

    def is_game_over(self) -> bool:
        return any(player.hp <= 0 for player in self.players)

    def winner(self) -> Optional[Player]:
        alive_players = [player for player in self.players if player.hp > 0]
        if len(alive_players) == 1:
            return alive_players[0]
        return None

    def get_state_summary(self) -> Dict[str, object]:
        return {
            "turn": self.turn_number,
            "current_player": self.current_player().name,
            "players": [
                {
                    "name": player.name,
                    "hp": player.hp,
                    "mana": player.mana,
                    "era": player.era_level,
                    "resources": dict(player.resources),
                    "hand_size": len(player.hand),
                }
                for player in self.players
            ],
            "provinces": [
                {
                    "owner": province.owner,
                    "cells": province.cells,
                    "resource": province.resource_type,
                    "unit": {
                        "kind": province.unit.kind,
                        "level": province.unit.level,
                        "hp": province.unit.hp,
                    },
                    "protected_turns": province.protected_turns,
                    "tempo_bonus": province.tempo_bonus,
                }
                for province in self.provinces
            ],
            "game_over": self.is_game_over(),
            "winner": self.winner().name if self.winner() else None,
        }

    def render_board(self) -> str:
        rows: List[str] = []
        for y in range(self.size):
            cells = []
            for x in range(self.size):
                cell = (x, y)
                if self._is_closed_cell(cell):
                    owner = self._owner_of_cell(cell)
                    marker = owner or "?"
                else:
                    marker = "."
                cells.append(f" {marker} ")
            rows.append("|" + "|".join(cells) + "|")
            rows.append("+" + "+".join(["---"] * self.size) + "+")
        return "\n".join(rows[:-1])

    def draw_card(self, player: Player) -> bool:
        if len(player.hand) >= self.max_hand_size:
            return False
        if not player.deck:
            return False
        player.hand.append(player.deck.pop(0))
        return True

    def start_turn(self) -> None:
        player = self.current_player()
        player.mana += self.mana_regen + player.mana_regen_bonus
        self.collect_resources(player)
        self.draw_card(player)

    def end_turn(self) -> None:
        self.turn_number += 1
        self._decrement_province_protection()
        self.start_turn()
        self.current_player_index = (self.current_player_index + 1) % len(self.players)

    def _decrement_province_protection(self) -> None:
        for province in self.provinces:
            if province.protected_turns > 0:
                province.protected_turns -= 1
            if province.protected_turns == 0 and province.tempo_bonus > 0:
                province.unit.hp += 1
                province.tempo_bonus = max(0, province.tempo_bonus - 1)

    def play_edge(self, player_name: str, start: Tuple[int, int], end: Tuple[int, int]) -> None:
        if player_name not in {player.name for player in self.players}:
            raise ValueError(f"unknown player: {player_name}")

        key = tuple(sorted((start, end)))
        self.edges[key] = player_name
        self._resolve_provinces()
        if self.capture_surrounded_provinces():
            self._resolve_provinces()

    def play_card(
        self,
        player_name: str,
        card: Card,
        province_index: Optional[int] = None,
        target_player_name: Optional[str] = None,
        start: Optional[Tuple[int, int]] = None,
        end: Optional[Tuple[int, int]] = None,
    ) -> bool:
        player = self.get_player(player_name)
        if player.mana < card.cost:
            raise ValueError("not enough mana to play this card")

        if card in player.hand:
            player.hand.remove(card)

        player.mana -= card.cost

        if card.effect == "evolve":
            if province_index is None:
                raise ValueError("province index is required for evolve cards")
            if not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            province = self.provinces[province_index]
            if province.owner != player_name:
                raise ValueError("province does not belong to the player")
            province.unit.level += 1
            province.unit.hp += 2
            return True

        if card.effect == "attack":
            if province_index is not None:
                return self._attack_province(player_name, province_index, card.value)
            if not target_player_name:
                raise ValueError("target_player_name is required for attack cards")
            target = self.get_player(target_player_name)
            target.hp = max(0, target.hp - card.value)
            return True

        if card.effect == "duel":
            if province_index is None:
                raise ValueError("province index is required for duel cards")
            if not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            province = self.provinces[province_index]
            if province.owner == player_name:
                raise ValueError("cannot duel your own province")

            attacker_strength = card.value + player.era_level
            defender_strength = province.unit.level + province.unit.hp
            if attacker_strength > defender_strength:
                province.owner = player_name
                province.unit = Unit(kind="recruit", level=1, hp=3)
                return True

            province.unit.hp = max(0, province.unit.hp - max(1, card.value - province.unit.level))
            return True

        if card.effect == "fortify":
            if province_index is None:
                raise ValueError("province index is required for fortify cards")
            if not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            province = self.provinces[province_index]
            if province.owner != player_name:
                raise ValueError("province does not belong to the player")
            province.unit.hp += card.value
            if province.unit.hp >= 6 and province.unit.kind != "fortress":
                province.unit.kind = "fortress"
                province.unit.level += 1
            return True

        if card.effect == "support":
            if province_index is None:
                raise ValueError("province index is required for support cards")
            if not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            province = self.provinces[province_index]
            if province.owner != player_name:
                raise ValueError("province does not belong to the player")

            for other in self.provinces:
                if other.owner != player_name:
                    continue
                if other is province:
                    continue
                if self._are_adjacent(province, other):
                    other.unit.hp += card.value
            return True

        if card.effect == "pressure":
            if province_index is None:
                raise ValueError("province index is required for pressure cards")
            if not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            province = self.provinces[province_index]
            if province.owner != player_name:
                raise ValueError("province does not belong to the player")

            for other in self.provinces:
                if other.owner == player_name:
                    continue
                if self._are_adjacent(province, other):
                    other.unit.hp = max(0, other.unit.hp - card.value)
            return True

        if card.effect == "influence":
            if province_index is None:
                raise ValueError("province index is required for influence cards")
            if not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            province = self.provinces[province_index]
            if province.owner != player_name:
                raise ValueError("province does not belong to the player")

            affected = [province]
            frontier = [province]
            while frontier:
                current = frontier.pop()
                for other in self.provinces:
                    if other.owner != player_name or other in affected:
                        continue
                    if self._are_adjacent(current, other):
                        affected.append(other)
                        frontier.append(other)

            for other in affected:
                other.unit.hp += card.value
            return True

        if card.effect == "tempo":
            if province_index is None:
                raise ValueError("province index is required for tempo cards")
            if not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            province = self.provinces[province_index]
            if province.owner != player_name:
                raise ValueError("province does not belong to the player")

            province.unit.hp += card.value
            province.tempo_bonus = max(province.tempo_bonus, card.value)
            province.protected_turns = max(province.protected_turns, 1)
            return True

        if card.effect == "conquest":
            if start is None or end is None:
                raise ValueError("start and end coordinates are required for conquest cards")
            self.play_edge(player_name, start, end)
            return True

        if card.effect == "trap":
            if province_index is None:
                raise ValueError("province index is required for trap cards")
            if not 0 <= province_index < len(self.provinces):
                raise ValueError("province index is out of range")
            province = self.provinces[province_index]
            if province.owner != player_name:
                raise ValueError("province does not belong to the player")
            province.protected_turns = max(province.protected_turns, card.value)
            return True

        if card.effect == "advance_era":
            return self.advance_era(player_name)

        if card.effect == "resource":
            player.resources[card.target] = player.resources.get(card.target, 0) + card.value
            return True

        raise ValueError(f"unsupported card effect: {card.effect}")

    def collect_resources(self, player: Player) -> None:
        for province in self.provinces:
            if province.owner == player.name:
                yield_amount = {
                    "wood": 1,
                    "stone": 1,
                    "food": 1,
                }.get(province.resource_type, 1)
                player.resources[province.resource_type] += yield_amount * province.unit.level

    def _attack_province(self, attacker_name: str, province_index: int, damage: int) -> bool:
        if not 0 <= province_index < len(self.provinces):
            raise ValueError("province index is out of range")
        province = self.provinces[province_index]
        if province.owner == attacker_name:
            raise ValueError("cannot attack your own province")
        if province.protected_turns > 0:
            return True

        province.unit.hp = max(0, province.unit.hp - damage)
        if province.unit.hp == 0:
            province.owner = attacker_name
            province.unit = Unit(kind="recruit", level=1, hp=3)
        return True

    def era_upgrade_cost(self, player: Player) -> Dict[str, int]:
        if player.era_level == 1:
            return {"wood": 2, "food": 1, "knowledge": 1}
        if player.era_level == 2:
            return {"wood": 3, "stone": 2, "knowledge": 2}
        return {"wood": 4, "stone": 4, "food": 2, "knowledge": 3}

    def can_advance_era(self, player_name: str) -> bool:
        player = self.get_player(player_name)
        cost = self.era_upgrade_cost(player)
        return all(player.resources.get(resource, 0) >= amount for resource, amount in cost.items())

    def advance_era(self, player_name: str) -> bool:
        player = self.get_player(player_name)
        if player.era_level >= 3:
            raise ValueError("player is already at maximum era")
        cost = self.era_upgrade_cost(player)
        if not self.can_advance_era(player_name):
            raise ValueError("not enough resources to advance era")

        for resource, amount in cost.items():
            player.resources[resource] -= amount

        player.era_level += 1
        player.mana_regen_bonus += 1
        self._strengthen_provinces(player_name)
        return True

    def _strengthen_provinces(self, player_name: str) -> None:
        for province in self.provinces:
            if province.owner == player_name:
                province.unit.hp += 1

    def capture_surrounded_provinces(self) -> bool:
        if not self.provinces:
            return False

        cell_owner = self._province_cell_owner_map()
        changed = False

        for province in list(self.provinces):
            adjacent_owners = set()
            has_liberty = False

            for cell in province.cells:
                for neighbor in self._adjacent_cells(cell):
                    if neighbor not in cell_owner:
                        has_liberty = True
                        break
                    if cell_owner[neighbor] != province.owner:
                        adjacent_owners.add(cell_owner[neighbor])
                if has_liberty:
                    break

            if has_liberty:
                continue

            if len(adjacent_owners) == 1 and province.protected_turns == 0:
                province.owner = next(iter(adjacent_owners))
                changed = True

        return changed

    def _province_cell_owner_map(self) -> Dict[Tuple[int, int], str]:
        return {cell: province.owner for province in self.provinces for cell in province.cells}

    def _resolve_provinces(self) -> None:
        self.provinces = []
        cell_owner: Dict[Tuple[int, int], str] = {}
        for y in range(self.size):
            for x in range(self.size):
                cell = (x, y)
                if self._is_closed_cell(cell):
                    owner = self._owner_of_cell(cell)
                    if owner is not None:
                        cell_owner[cell] = owner

        visited: set[Tuple[int, int]] = set()
        for cell, owner in cell_owner.items():
            if cell in visited:
                continue

            connected_cells = [cell]
            queue = [cell]
            visited.add(cell)

            while queue:
                current = queue.pop()
                for neighbor in self._adjacent_cells(current):
                    if neighbor in cell_owner and neighbor not in visited and cell_owner[neighbor] == owner:
                        visited.add(neighbor)
                        queue.append(neighbor)
                        connected_cells.append(neighbor)

            self.provinces.append(
                Province(
                    owner=owner,
                    cells=sorted(connected_cells),
                    resource_type=self._resource_type_for_cell(cell),
                    unit=Unit(kind="recruit", level=1, hp=3),
                )
            )

    def _is_closed_cell(self, cell: Tuple[int, int]) -> bool:
        x, y = cell
        if x + 1 >= self.size or y + 1 >= self.size:
            return False
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

    def _resource_type_for_cell(self, cell: Tuple[int, int]) -> str:
        x, y = cell
        types = ["wood", "stone", "food"]
        return types[(x + y) % len(types)]

    def _adjacent_cells(self, cell: Tuple[int, int]) -> List[Tuple[int, int]]:
        x, y = cell
        candidates = [
            (x - 1, y),
            (x + 1, y),
            (x, y - 1),
            (x, y + 1),
        ]
        return [
            candidate
            for candidate in candidates
            if 0 <= candidate[0] < self.size and 0 <= candidate[1] < self.size
        ]

    def _are_adjacent(self, first: Province, second: Province) -> bool:
        for first_cell in first.cells:
            for second_cell in second.cells:
                if abs(first_cell[0] - second_cell[0]) + abs(first_cell[1] - second_cell[1]) == 1:
                    return True
        return False
