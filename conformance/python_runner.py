from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from hexa_octarina_conquer import GameState, Player  # noqa: E402


def normalize(game: GameState) -> dict[str, object]:
    cells = [
        {"x": x, "y": y, "owner": owner}
        for (x, y), owner in sorted(game.cell_owners.items())
    ]
    provinces = [
        {
            "owner": province.owner,
            "cells": [list(cell) for cell in sorted(province.cells)],
            "unit": {
                "kind": province.unit.kind,
                "level": province.unit.level,
                "hp": province.unit.hp,
            },
        }
        for province in sorted(game.provinces, key=lambda item: (item.owner, item.cells))
    ]
    return {"cells": cells, "provinces": provinces}


def run_scenario(scenario: dict[str, object]) -> dict[str, object]:
    players = [Player(name) for name in scenario["players"]]
    game = GameState(size=int(scenario["size"]), players=players)
    for operation in scenario["operations"]:
        game.play_edge(
            operation["actor"],
            tuple(operation["start"]),
            tuple(operation["end"]),
            consume_action=False,
        )
    return normalize(game)


def main() -> None:
    scenario = json.load(sys.stdin)
    json.dump(run_scenario(scenario), sys.stdout, sort_keys=True)


if __name__ == "__main__":
    main()
