import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from hexa_octarina_conquer import Card, GameState, Player, Province, Unit


class GameEngineTests(unittest.TestCase):
    def test_complete_cell_creates_province_and_unit(self):
        game = GameState(size=2, players=[Player("A"), Player("B")])

        game.play_edge("A", (0, 0), (0, 1))
        game.play_edge("A", (0, 1), (1, 1))
        game.play_edge("A", (1, 0), (1, 1))
        game.play_edge("A", (0, 0), (1, 0))

        self.assertEqual(len(game.provinces), 1)
        self.assertEqual(game.provinces[0].owner, "A")
        self.assertEqual(game.provinces[0].unit.kind, "recruit")

    def test_cards_can_be_played_when_cost_is_affordable(self):
        card = Card(name="Alquimia Arquitetônica", cost=2, effect="evolve")
        game = GameState(size=2, players=[Player("A"), Player("B")])
        game.players[0].mana = 3

        self.assertTrue(card.is_playable(game.players[0].mana))
        self.assertEqual(card.effect, "evolve")

    def test_evolving_province_increases_unit_level_and_consumes_mana(self):
        game = GameState(size=2, players=[Player("A"), Player("B")])

        game.play_edge("A", (0, 0), (0, 1))
        game.play_edge("A", (0, 1), (1, 1))
        game.play_edge("A", (1, 0), (1, 1))
        game.play_edge("A", (0, 0), (1, 0))

        card = Card(name="Alquimia Arquitetônica", cost=2, effect="evolve")
        played = game.play_card("A", card, 0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[0].unit.level, 2)
        self.assertEqual(game.provinces[0].unit.hp, 5)
        self.assertEqual(game.get_player("A").mana, 1)

    def test_surrounded_province_is_captured_by_the_surrounding_player(self):
        game = GameState(size=3, players=[Player("A"), Player("B")])
        game.provinces = [
            Province(owner="A", cells=[(0, 0)], unit=Unit(kind="recruit", level=1, hp=3)),
            Province(owner="B", cells=[(1, 0)], unit=Unit(kind="recruit", level=1, hp=3)),
            Province(owner="B", cells=[(0, 1)], unit=Unit(kind="recruit", level=1, hp=3)),
            Province(owner="B", cells=[(1, 1)], unit=Unit(kind="recruit", level=1, hp=3)),
        ]

        game.capture_surrounded_provinces()

        self.assertEqual(game.provinces[0].owner, "B")


if __name__ == "__main__":
    unittest.main()
