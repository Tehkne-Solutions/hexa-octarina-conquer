import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from hexa_octarina_conquer import Card, GameState, Player, Unit


class GameEngineTests(unittest.TestCase):
    def make_game(self, size=3):
        return GameState(size=size, players=[Player("A"), Player("B")])

    def close_cell(self, game, owner, x=0, y=0):
        game.play_edge(owner, (x, y), (x + 1, y))
        game.play_edge(owner, (x, y), (x, y + 1))
        game.play_edge(owner, (x + 1, y), (x + 1, y + 1))
        return game.play_edge(owner, (x, y + 1), (x + 1, y + 1))

    def test_invalid_and_duplicate_edges_are_rejected(self):
        game = self.make_game()
        with self.assertRaises(ValueError):
            game.play_edge("A", (0, 0), (1, 1))
        with self.assertRaises(ValueError):
            game.play_edge("A", (-1, 0), (0, 0))
        game.play_edge("A", (0, 0), (1, 0))
        with self.assertRaises(ValueError):
            game.play_edge("B", (1, 0), (0, 0))

    def test_player_who_closes_cell_owns_it_even_with_mixed_edges(self):
        game = self.make_game(size=2)
        game.play_edge("A", (0, 0), (1, 0))
        game.play_edge("B", (0, 0), (0, 1))
        game.play_edge("A", (1, 0), (1, 1))
        claimed = game.play_edge("B", (0, 1), (1, 1))
        self.assertEqual(claimed, [(0, 0)])
        self.assertEqual(game.cell_owners[(0, 0)], "B")
        self.assertEqual(game.provinces[0].owner, "B")

    def test_closing_cell_grants_extra_board_action(self):
        game = self.make_game(size=2)
        game.start_turn()
        game.actions_remaining = 4
        game.play_edge("A", (0, 0), (1, 0))
        game.play_edge("A", (0, 0), (0, 1))
        game.play_edge("A", (1, 0), (1, 1))
        self.assertEqual(game.actions_remaining, 1)
        game.play_edge("A", (0, 1), (1, 1))
        self.assertEqual(game.actions_remaining, 1)

    def test_end_turn_starts_the_next_player_not_the_previous_one(self):
        player_a = Player("A", mana=1)
        player_b = Player("B", mana=5, deck=[Card("Draw", 0, "resource", value=1, target="wood")])
        game = GameState(size=2, players=[player_a, player_b])
        game.start_turn()
        self.assertEqual(player_a.mana, 2)
        game.end_turn()
        self.assertEqual(game.current_player().name, "B")
        self.assertEqual(player_a.mana, 2)
        self.assertEqual(player_b.mana, 6)
        self.assertEqual(len(player_b.hand), 1)

    def test_province_progress_survives_later_edges(self):
        game = self.make_game(size=3)
        self.close_cell(game, "A", 0, 0)
        province = game.provinces[0]
        province.unit = Unit(kind="fortress", level=3, hp=11)
        province.protected_turns = 2
        game.play_edge("B", (1, 0), (2, 0))
        persisted = game.provinces[0]
        self.assertEqual(persisted.id, province.id)
        self.assertEqual(persisted.unit.kind, "fortress")
        self.assertEqual(persisted.unit.level, 3)
        self.assertEqual(persisted.unit.hp, 11)
        self.assertEqual(persisted.protected_turns, 2)

    def test_connected_cells_merge_and_keep_strongest_progress(self):
        game = self.make_game(size=3)
        self.close_cell(game, "A", 0, 0)
        game.provinces[0].unit = Unit(kind="fortress", level=2, hp=8)
        game.play_edge("A", (1, 0), (2, 0))
        game.play_edge("A", (2, 0), (2, 1))
        game.play_edge("A", (1, 1), (2, 1))
        self.assertEqual(len(game.provinces), 1)
        self.assertEqual(game.provinces[0].cells, [(0, 0), (1, 0)])
        self.assertEqual(game.provinces[0].unit.kind, "fortress")
        self.assertEqual(game.provinces[0].unit.hp, 8)

    def test_invalid_card_target_does_not_consume_card_or_mana(self):
        card = Card("Fortaleza", 2, "fortify", value=3)
        player = Player("A", mana=3, hand=[card])
        game = GameState(size=2, players=[player, Player("B")])
        with self.assertRaises(ValueError):
            game.play_card("A", card, province_index=0)
        self.assertIn(card, player.hand)
        self.assertEqual(player.mana, 3)

    def test_surround_opens_duel_instead_of_silent_capture(self):
        game = self.make_game(size=3)
        game.cell_owners = {(0, 0): "A", (1, 0): "B", (0, 1): "B", (1, 1): "B"}
        game._rebuild_provinces()
        duels = game.detect_surrounded_provinces()
        self.assertEqual(len(duels), 1)
        self.assertEqual(duels[0].attacker, "B")
        self.assertEqual(duels[0].defender, "A")
        self.assertEqual(game.cell_owners[(0, 0)], "A")

    def test_trap_prevents_surround_duel_until_protection_expires(self):
        game = self.make_game(size=3)
        game.cell_owners = {(0, 0): "A", (1, 0): "B", (0, 1): "B", (1, 1): "B"}
        game._rebuild_provinces()
        game.provinces[0].protected_turns = 1
        self.assertEqual(game.detect_surrounded_provinces(), [])

    def test_wet_then_electric_combo_resolves_duel_and_captures(self):
        wet = Card("Maré", 1, "status", status="wet", duration=2, element="water")
        lightning = Card("Raio", 2, "attack", value=4, element="electric")
        defender_attack = Card("Golpe", 1, "attack", value=1, element="physical")
        player_a = Player("A", hand=[wet, lightning], faction_element="water", era_level=2)
        player_b = Player("B", hand=[defender_attack], faction_element="fire")
        game = GameState(size=3, players=[player_a, player_b])
        game.cell_owners = {(0, 0): "B", (1, 0): "A", (0, 1): "A", (1, 1): "A"}
        game._rebuild_provinces()
        target_index = next(i for i, province in enumerate(game.provinces) if province.owner == "B")
        duel = game.open_duel("A", target_index, reason="surround")
        duel.defender_state.hp = 8
        duel.defender_state.max_hp = 8
        duel = game.resolve_duel_round(duel.id, [wet, lightning], [defender_attack])
        self.assertEqual(duel.status, "resolved")
        self.assertEqual(duel.winner, "A")
        self.assertEqual(game.cell_owners[(0, 0)], "A")

    def test_resource_collection_includes_knowledge_cells(self):
        game = self.make_game(size=4)
        game.cell_owners = {(1, 1): "A"}
        game._rebuild_provinces()
        player = game.get_player("A")
        game.collect_resources(player)
        self.assertEqual(player.resources["knowledge"], 1)

    def test_advance_era_consumes_resources_and_strengthens_provinces(self):
        card = Card("Avanço", 1, "advance_era")
        player = Player("A", mana=2, resources={"wood": 2, "stone": 0, "food": 1, "knowledge": 1}, hand=[card])
        game = GameState(size=2, players=[player, Player("B")])
        game.cell_owners = {(0, 0): "A"}
        game._rebuild_provinces()
        before_hp = game.provinces[0].unit.hp
        game.play_card("A", card)
        self.assertEqual(player.era_level, 2)
        self.assertEqual(player.mana_regen_bonus, 1)
        self.assertEqual(game.provinces[0].unit.hp, before_hp + 1)

    def test_state_summary_exposes_pending_duels_and_recent_events(self):
        game = self.make_game(size=3)
        game.cell_owners = {(0, 0): "A", (1, 0): "B", (0, 1): "B", (1, 1): "B"}
        game._rebuild_provinces()
        game.detect_surrounded_provinces()
        summary = game.get_state_summary()
        self.assertEqual(len(summary["pending_duels"]), 1)
        self.assertTrue(any(event["type"] == "duel_opened" for event in summary["recent_events"]))

    def test_render_board_displays_edges_and_owner(self):
        game = self.make_game(size=2)
        self.close_cell(game, "A")
        rendered = game.render_board()
        self.assertIn("●───●", rendered)
        self.assertIn(" A ", rendered)


if __name__ == "__main__":
    unittest.main()
