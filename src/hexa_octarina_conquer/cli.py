from __future__ import annotations

import json
from typing import Tuple

from .catalog import starter_deck
from .game_state import GameState
from .models import Player


def parse_command(raw: str) -> Tuple[str, tuple[object, ...]]:
    parts = raw.strip().split()
    if not parts:
        raise ValueError("unsupported command")
    if parts[0] == "edge" and len(parts) == 5:
        return "edge", ((int(parts[1]), int(parts[2])), (int(parts[3]), int(parts[4])))
    if parts[0] == "state":
        return "state", ()
    if parts[0] == "duels":
        return "duels", ()
    if parts[0] == "end":
        return "end", ()
    raise ValueError("unsupported command")


def build_demo_game() -> GameState:
    deck_a = starter_deck()
    deck_b = starter_deck()
    game = GameState(
        size=4,
        players=[
            Player("A", deck=deck_a[3:], hand=deck_a[:3], faction_element="water"),
            Player("B", deck=deck_b[3:], hand=deck_b[:3], faction_element="fire"),
        ],
    )
    game.start_turn()
    return game


def main() -> None:
    game = build_demo_game()
    print("Hexa Octarina Conquer — referência tática")
    print(game.render_board())
    print("Comandos: edge x1 y1 x2 y2 | state | duels | end | quit")

    while not game.is_game_over():
        try:
            raw = input("comando> ").strip()
        except EOFError:
            break
        if raw == "quit":
            break
        try:
            command, payload = parse_command(raw)
            if command == "edge":
                start, end = payload
                game.play_edge(game.current_player().name, start, end)
                print(game.render_board())
            elif command == "state":
                print(json.dumps(game.get_state_summary(), ensure_ascii=False, indent=2))
            elif command == "duels":
                print(json.dumps(game.get_state_summary()["pending_duels"], ensure_ascii=False, indent=2))
            elif command == "end":
                game.end_turn()
                print(f"Turno {game.turn_number}: {game.current_player().name}")
        except (ValueError, IndexError) as exc:
            print(f"Erro: {exc}")


if __name__ == "__main__":
    main()
