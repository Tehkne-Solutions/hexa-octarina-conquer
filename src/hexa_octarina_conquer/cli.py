from __future__ import annotations

from typing import Tuple

from .cards import Card
from .game_state import GameState
from .models import Player


def parse_command(raw: str) -> Tuple[str, tuple[object, ...]]:
    parts = raw.strip().split()
    if not parts:
        raise ValueError("unsupported command")

    if parts[0] == "edge" and len(parts) == 5:
        return "edge", ((int(parts[1]), int(parts[2])), (int(parts[3]), int(parts[4])))

    if parts[0] == "card" and len(parts) >= 2:
        return "card", (parts[1], *[int(part) for part in parts[2:]])

    if parts[0] == "state":
        return "state", ()

    if parts[0] == "end":
        return "end", ()

    raise ValueError("unsupported command")


def build_demo_game() -> GameState:
    players = [
        Player("A", mana=3, deck=[Card(name="Expansão", cost=1, effect="conquest")], hand=[Card(name="Fortaleza", cost=1, effect="fortify", value=3)]),
        Player("B", mana=3, deck=[Card(name="Expansão", cost=1, effect="conquest")], hand=[Card(name="Fortaleza", cost=1, effect="fortify", value=3)]),
    ]
    return GameState(size=3, players=players)


def main() -> None:
    game = build_demo_game()
    game.start_turn()

    print("Hexa Octarina Conquer - demo terminal")
    print(game.render_board())
    print(f"Turno {game.turn_number}: {game.current_player().name}")
    print("Comandos: edge x1 y1 x2 y2 | card <name> <province_index> | state | end | quit")

    while not game.is_game_over():
        try:
            raw = input("comando> ").strip()
        except EOFError:
            break

        if not raw:
            continue
        if raw == "quit":
            break
        if raw.startswith("help"):
            print("Comandos: edge x1 y1 x2 y2 | card <name> <province_index> | state | end | quit")
            continue

        try:
            command, payload = parse_command(raw)
        except ValueError as exc:
            print(exc)
            continue

        if command == "edge":
            start, end = payload
            game.play_edge(game.current_player().name, start, end)
            print(game.render_board())
            print(f"Turno {game.turn_number}: {game.current_player().name}")
            game.end_turn()
            print(f"Próximo jogador: {game.current_player().name}")
            continue

        if command == "card":
            card_name, *values = payload
            province_index = int(values[0]) if values else None
            card = next((item for item in game.current_player().hand if item.name.lower() == str(card_name).lower()), None)
            if card is None:
                print("Carta não encontrada na mão atual")
                continue
            if province_index is None:
                print("Informe o índice da província")
                continue
            try:
                game.play_card(game.current_player().name, card, province_index=province_index)
            except Exception as exc:
                print(exc)
                continue
            print(game.render_board())
            print(game.get_state_summary())
            game.end_turn()
            print(f"Próximo jogador: {game.current_player().name}")
            continue

        if command == "state":
            print(game.get_state_summary())
            continue

        if command == "end":
            game.end_turn()
            print(f"Próximo jogador: {game.current_player().name}")


if __name__ == "__main__":
    main()
