from __future__ import annotations

from typing import List, Tuple

Point = Tuple[int, int]
Cell = Tuple[int, int]
Edge = Tuple[Point, Point]


class BoardGeometryMixin:
    @property
    def cell_size(self) -> int:
        return self.size - 1

    def render_board(self) -> str:
        rows: List[str] = []
        for y in range(self.size):
            top = []
            for x in range(self.size - 1):
                edge = self._canonical_edge((x, y), (x + 1, y))
                top.append("●" + ("───" if edge in self.edges else "   "))
            top.append("●")
            rows.append("".join(top))
            if y < self.size - 1:
                middle = []
                for x in range(self.size):
                    vertical = self._canonical_edge((x, y), (x, y + 1))
                    middle.append("│" if vertical in self.edges else " ")
                    if x < self.size - 1:
                        owner = self.cell_owners.get((x, y), " ")
                        middle.append(f" {owner[:1] if owner else ' '} ")
                rows.append("".join(middle))
        return "\n".join(rows)

    def play_edge(
        self,
        player_name: str,
        start: Point,
        end: Point,
        *,
        consume_action: bool = True,
    ) -> List[Cell]:
        self._ensure_actor(player_name)
        edge = self._validate_edge(start, end)
        if edge in self.edges:
            raise ValueError("edge already exists")
        if self.started and consume_action and self.actions_remaining <= 0:
            raise ValueError("no board actions remaining")

        self.edges[edge] = player_name
        claimed: List[Cell] = []
        for cell in self._cells_touching_edge(edge):
            if cell not in self.cell_owners and self._is_closed_cell(cell):
                self.cell_owners[cell] = player_name
                claimed.append(cell)
                self._emit("cell_claimed", player_name, cell=cell)

        if self.started and consume_action:
            self.actions_remaining -= 1
            self.actions_remaining += len(claimed)
        if claimed:
            self._rebuild_provinces()
            self.detect_surrounded_provinces()
        self._emit("edge_played", player_name, start=start, end=end, claimed=claimed)
        return claimed

    def _validate_edge(self, start: Point, end: Point) -> Edge:
        if not self._point_in_bounds(start) or not self._point_in_bounds(end):
            raise ValueError("edge point is outside the board")
        if abs(start[0] - end[0]) + abs(start[1] - end[1]) != 1:
            raise ValueError("edges must connect orthogonally adjacent points")
        return self._canonical_edge(start, end)

    @staticmethod
    def _canonical_edge(start: Point, end: Point) -> Edge:
        return tuple(sorted((start, end)))  # type: ignore[return-value]

    def _point_in_bounds(self, point: Point) -> bool:
        return 0 <= point[0] < self.size and 0 <= point[1] < self.size

    def _cell_in_bounds(self, cell: Cell) -> bool:
        return 0 <= cell[0] < self.cell_size and 0 <= cell[1] < self.cell_size

    def _cells_touching_edge(self, edge: Edge) -> List[Cell]:
        (x1, y1), (x2, y2) = edge
        if y1 == y2:
            x = min(x1, x2)
            candidates = [(x, y1 - 1), (x, y1)]
        else:
            y = min(y1, y2)
            candidates = [(x1 - 1, y), (x1, y)]
        return [cell for cell in candidates if self._cell_in_bounds(cell)]

    def _is_closed_cell(self, cell: Cell) -> bool:
        if not self._cell_in_bounds(cell):
            return False
        x, y = cell
        required = [
            self._canonical_edge((x, y), (x + 1, y)),
            self._canonical_edge((x + 1, y), (x + 1, y + 1)),
            self._canonical_edge((x, y + 1), (x + 1, y + 1)),
            self._canonical_edge((x, y), (x, y + 1)),
        ]
        return all(edge in self.edges for edge in required)
