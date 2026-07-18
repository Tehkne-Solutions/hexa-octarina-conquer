from __future__ import annotations

from typing import Iterable, List, Set

from .board_geometry import Cell
from .models import Province, Unit


class ProvinceRulesMixin:
    def collect_resources(self, player) -> None:
        for province in self.provinces:
            if province.owner != player.name:
                continue
            for cell in province.cells:
                resource = self._resource_type_for_cell(cell)
                player.resources[resource] = player.resources.get(resource, 0) + province.unit.level

    def _rebuild_provinces(self) -> None:
        old_by_cell = {cell: province for province in self.provinces for cell in province.cells}
        visited: Set[Cell] = set()
        rebuilt: List[Province] = []
        for cell in sorted(self.cell_owners):
            if cell in visited:
                continue
            owner = self.cell_owners[cell]
            group: List[Cell] = []
            queue = [cell]
            visited.add(cell)
            while queue:
                current = queue.pop()
                group.append(current)
                for neighbor in self._adjacent_cells(current):
                    if neighbor in self.cell_owners and neighbor not in visited and self.cell_owners[neighbor] == owner:
                        visited.add(neighbor)
                        queue.append(neighbor)
            group = sorted(set(group))
            candidates = []
            for group_cell in group:
                candidate = old_by_cell.get(group_cell)
                if candidate and candidate.owner == owner and candidate not in candidates:
                    candidates.append(candidate)
            if candidates:
                primary = sorted(candidates, key=lambda item: item.id or "~")[0]
                strongest = max(candidates, key=lambda item: item.unit.strength)
                province = Province(
                    owner=owner,
                    cells=group,
                    resource_type=self._resource_type_for_cell(group[0]),
                    unit=Unit(
                        kind=strongest.unit.kind,
                        level=max(item.unit.level for item in candidates),
                        hp=max(item.unit.hp for item in candidates),
                        element=strongest.unit.element,
                    ),
                    protected_turns=max(item.protected_turns for item in candidates),
                    tempo_bonus=max(item.tempo_bonus for item in candidates),
                    id=primary.id or self._new_province_id(),
                )
            else:
                province = Province(
                    owner=owner,
                    cells=group,
                    resource_type=self._resource_type_for_cell(group[0]),
                    unit=Unit(element=self.get_player(owner).faction_element),
                    id=self._new_province_id(),
                )
            rebuilt.append(province)
        self.provinces = sorted(rebuilt, key=lambda item: item.cells[0])

    def _new_province_id(self) -> str:
        province_id = f"province-{self.next_province_id}"
        self.next_province_id += 1
        return province_id

    def _resource_type_for_cell(self, cell: Cell) -> str:
        types = ["wood", "stone", "food", "knowledge"]
        return types[(cell[0] + cell[1] * 2) % len(types)]

    def _adjacent_cells(self, cell: Cell) -> List[Cell]:
        x, y = cell
        candidates = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
        return [candidate for candidate in candidates if self._cell_in_bounds(candidate)]

    def _are_adjacent(self, first: Province, second: Province) -> bool:
        return any(
            abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1
            for a in first.cells
            for b in second.cells
        )

    def _connected_allied_provinces(self, origin: Province) -> Iterable[Province]:
        affected = [origin]
        frontier = [origin]
        while frontier:
            current = frontier.pop()
            for other in self.provinces:
                if other.owner != origin.owner or other in affected:
                    continue
                if self._are_adjacent(current, other):
                    affected.append(other)
                    frontier.append(other)
        return affected
