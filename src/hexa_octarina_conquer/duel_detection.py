from __future__ import annotations

from typing import List, Set

from .board_geometry import Cell
from .models import Duel, DuelCombatant, Province


class DuelDetectionMixin:
    def detect_surrounded_provinces(self) -> List[Duel]:
        created: List[Duel] = []
        for index, province in enumerate(list(self.provinces)):
            if province.protected_turns > 0:
                continue
            frontier: Set[Cell] = set()
            for cell in province.cells:
                frontier.update(n for n in self._adjacent_cells(cell) if n not in province.cells)
            if not frontier or len(frontier) <= len(province.cells):
                continue
            owners = {self.cell_owners.get(cell) for cell in frontier}
            if None in owners or len(owners) != 1:
                continue
            attacker = next(iter(owners))
            if attacker and attacker != province.owner:
                duel = self.open_duel(attacker, index, reason="surround")
                if duel not in created:
                    created.append(duel)
        return created

    def capture_surrounded_provinces(self, auto_resolve: bool = False) -> bool:
        duels = self.detect_surrounded_provinces()
        if auto_resolve:
            for duel in duels:
                province = self._province_by_id(duel.province_id)
                province.owner = duel.attacker
                for cell in province.cells:
                    self.cell_owners[cell] = duel.attacker
                duel.status = "resolved"
                duel.winner = duel.attacker
            if duels:
                self._rebuild_provinces()
        return bool(duels)

    def open_duel(self, attacker_name: str, province_index: int, reason: str = "contact") -> Duel:
        attacker = self.get_player(attacker_name)
        if not 0 <= province_index < len(self.provinces):
            raise ValueError("province index is out of range")
        province = self.provinces[province_index]
        if province.owner == attacker_name:
            raise ValueError("cannot duel your own province")
        for duel in self.pending_duels:
            if duel.province_id == province.id and duel.status != "resolved":
                return duel
        defender = self.get_player(province.owner)
        attack_support = self._attacker_support(attacker_name, province)
        defend_support = max(0, len(province.cells) - 1)
        attack_hp = 8 + attacker.era_level * 2 + attack_support
        defend_hp = max(6, province.unit.hp + province.unit.level * 2 + defend_support)
        duel = Duel(
            id=f"duel-{self.next_duel_id}",
            attacker=attacker_name,
            defender=province.owner,
            province_id=province.id,
            reason=reason,
            attacker_state=DuelCombatant(
                attacker_name, attack_hp, attack_hp, min(7, 3 + attack_support),
                attacker.faction_element, support_bonus=attack_support,
            ),
            defender_state=DuelCombatant(
                defender.name, defend_hp, defend_hp, min(7, 3 + defend_support),
                province.unit.element or defender.faction_element, support_bonus=defend_support,
            ),
        )
        self.next_duel_id += 1
        self.pending_duels.append(duel)
        self._emit("duel_opened", attacker_name, duel_id=duel.id, province_id=province.id, reason=reason)
        return duel

    def get_duel(self, duel_id: str) -> Duel:
        for duel in self.pending_duels:
            if duel.id == duel_id:
                return duel
        raise ValueError(f"unknown duel: {duel_id}")

    def _province_by_id(self, province_id: str) -> Province:
        for province in self.provinces:
            if province.id == province_id:
                return province
        raise ValueError(f"unknown province: {province_id}")

    def _attacker_support(self, attacker_name: str, target: Province) -> int:
        return len({
            neighbor
            for cell in target.cells
            for neighbor in self._adjacent_cells(cell)
            if self.cell_owners.get(neighbor) == attacker_name
        })
