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

    def test_connected_cells_form_single_province(self):
        game = GameState(size=3, players=[Player("A"), Player("B")])

        game.play_edge("A", (0, 0), (1, 0))
        game.play_edge("A", (0, 0), (0, 1))
        game.play_edge("A", (1, 0), (1, 1))
        game.play_edge("A", (0, 1), (1, 1))

        game.play_edge("A", (1, 0), (2, 0))
        game.play_edge("A", (2, 0), (2, 1))
        game.play_edge("A", (1, 1), (2, 1))

        self.assertEqual(len(game.provinces), 1)
        self.assertEqual(sorted(game.provinces[0].cells), [(0, 0), (1, 0)])
        self.assertEqual(game.provinces[0].owner, "A")

    def test_conquest_card_plays_edge_and_creates_province(self):
        player = Player("A", mana=2, hand=[Card(name="Expansão", cost=1, effect="conquest")])
        game = GameState(size=2, players=[player, Player("B")])

        card = player.hand[0]
        played = game.play_card("A", card, start=(0, 0), end=(1, 0))

        self.assertTrue(played)
        self.assertEqual(player.mana, 1)
        self.assertNotIn(card, player.hand)
        self.assertEqual(len(game.edges), 1)
        self.assertEqual(game.edges[tuple(sorted(((0, 0), (1, 0))))], "A")

    def test_trap_card_prevents_province_capture_for_protected_turns(self):
        player = Player("A", mana=3, hand=[Card(name="Muro de Espinhos", cost=1, effect="trap", value=2)])
        game = GameState(size=3, players=[player, Player("B")])
        game.provinces = [
            Province(owner="A", cells=[(0, 0)], resource_type="wood"),
            Province(owner="B", cells=[(1, 0)], resource_type="stone"),
            Province(owner="B", cells=[(0, 1)], resource_type="food"),
            Province(owner="B", cells=[(1, 1)], resource_type="wood"),
        ]

        played = game.play_card("A", player.hand[0], province_index=0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[0].protected_turns, 2)

        game.capture_surrounded_provinces()
        self.assertEqual(game.provinces[0].owner, "A")

        game.end_turn()
        self.assertEqual(game.provinces[0].protected_turns, 1)

    def test_attacks_do_not_damage_protected_provinces(self):
        attacker = Player("A", mana=3, hand=[Card(name="Golpe de Lâmina", cost=1, effect="attack", value=2)])
        defender = Player("B", mana=3)
        game = GameState(size=2, players=[attacker, defender])
        game.provinces = [Province(owner="B", cells=[(0, 0)], resource_type="stone", unit=Unit(kind="soldier", level=1, hp=5), protected_turns=1)]

        card = attacker.hand[0]
        played = game.play_card("A", card, province_index=0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[0].unit.hp, 5)
        self.assertEqual(attacker.mana, 2)

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

    def test_surrounded_province_is_not_captured_when_it_has_open_liberty(self):
        game = GameState(size=3, players=[Player("A"), Player("B")])
        game.provinces = [
            Province(owner="A", cells=[(0, 0)], unit=Unit(kind="recruit", level=1, hp=3)),
            Province(owner="B", cells=[(1, 0)], unit=Unit(kind="recruit", level=1, hp=3)),
        ]

        game.capture_surrounded_provinces()

        self.assertEqual(game.provinces[0].owner, "A")

    def test_start_turn_increases_mana_and_draws_card(self):
        player = Player("A", mana=1, deck=[Card(name="Attack", cost=1, effect="attack", value=2)])
        game = GameState(size=2, players=[player, Player("B")])

        game.start_turn()

        self.assertEqual(player.mana, 2)
        self.assertEqual(len(player.hand), 1)
        self.assertEqual(player.hand[0].name, "Attack")

    def test_attack_card_deals_damage_to_target_player(self):
        attacker = Player("A", mana=3, hand=[Card(name="Fogo Arcano", cost=2, effect="attack", value=4)])
        target = Player("B", mana=3, hp=20)
        game = GameState(size=2, players=[attacker, target])

        card = attacker.hand[0]
        played = game.play_card("A", card, target_player_name="B")

        self.assertTrue(played)
        self.assertEqual(target.hp, 16)
        self.assertEqual(attacker.mana, 1)

    def test_advance_era_card_consumes_resources_and_increases_era(self):
        player = Player("A", mana=3, resources={"wood": 2, "stone": 0, "food": 1, "knowledge": 1}, hand=[Card(name="Avanço de Era", cost=1, effect="advance_era")])
        game = GameState(size=2, players=[player, Player("B")])

        card = player.hand[0]
        played = game.play_card("A", card)

        self.assertTrue(played)
        self.assertEqual(player.era_level, 2)
        self.assertEqual(player.mana_regen_bonus, 1)
        self.assertEqual(player.resources["wood"], 0)
        self.assertEqual(player.resources["food"], 0)
        self.assertEqual(player.resources["knowledge"], 0)

    def test_attack_card_damages_enemy_province_without_capturing(self):
        attacker = Player("A", mana=3, hand=[Card(name="Spear Strike", cost=2, effect="attack", value=2)])
        defender = Player("B", mana=3)
        game = GameState(size=2, players=[attacker, defender])
        game.provinces = [Province(owner="B", cells=[(0, 0)], resource_type="stone", unit=Unit(kind="soldier", level=1, hp=5))]

        card = attacker.hand[0]
        played = game.play_card("A", card, province_index=0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[0].owner, "B")
        self.assertEqual(game.provinces[0].unit.hp, 3)
        self.assertEqual(attacker.mana, 1)

    def test_duel_card_can_capture_enemy_province_when_strength_is_superior(self):
        attacker = Player("A", mana=3, era_level=2, hand=[Card(name="Duelo de Campeões", cost=2, effect="duel", value=3)])
        defender = Player("B", mana=3)
        game = GameState(size=2, players=[attacker, defender])
        game.provinces = [Province(owner="B", cells=[(0, 0)], resource_type="stone", unit=Unit(kind="soldier", level=1, hp=2))]

        card = attacker.hand[0]
        played = game.play_card("A", card, province_index=0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[0].owner, "A")
        self.assertEqual(attacker.mana, 1)

    def test_support_card_strengthens_adjacent_allied_provinces(self):
        player = Player("A", mana=3, hand=[Card(name="Reforço de Fronteira", cost=1, effect="support", value=2)])
        game = GameState(size=2, players=[player, Player("B")])
        game.provinces = [
            Province(owner="A", cells=[(0, 0)], resource_type="wood", unit=Unit(kind="soldier", level=1, hp=3)),
            Province(owner="A", cells=[(1, 0)], resource_type="stone", unit=Unit(kind="soldier", level=1, hp=2)),
        ]

        card = player.hand[0]
        played = game.play_card("A", card, province_index=0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[1].unit.hp, 4)
        self.assertEqual(player.mana, 2)

    def test_area_pressure_card_reduces_adjacent_enemy_provinces(self):
        player = Player("A", mana=3, hand=[Card(name="Pressão de Campo", cost=1, effect="pressure", value=2)])
        game = GameState(size=2, players=[player, Player("B")])
        game.provinces = [
            Province(owner="A", cells=[(0, 0)], resource_type="wood", unit=Unit(kind="soldier", level=1, hp=3)),
            Province(owner="B", cells=[(1, 0)], resource_type="stone", unit=Unit(kind="soldier", level=1, hp=4)),
        ]

        card = player.hand[0]
        played = game.play_card("A", card, province_index=0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[1].unit.hp, 2)
        self.assertEqual(player.mana, 2)

    def test_influence_card_strengthens_connected_allied_provinces(self):
        player = Player("A", mana=3, hand=[Card(name="Influência Estratégica", cost=1, effect="influence", value=1)])
        game = GameState(size=2, players=[player, Player("B")])
        game.provinces = [
            Province(owner="A", cells=[(0, 0)], resource_type="wood", unit=Unit(kind="soldier", level=1, hp=3)),
            Province(owner="A", cells=[(1, 0)], resource_type="stone", unit=Unit(kind="soldier", level=1, hp=2)),
        ]

        card = player.hand[0]
        played = game.play_card("A", card, province_index=0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[0].unit.hp, 4)
        self.assertEqual(game.provinces[1].unit.hp, 3)
        self.assertEqual(player.mana, 2)

    def test_tempo_card_increases_resilience_after_turns(self):
        player = Player("A", mana=3, hand=[Card(name="Ritmo de Guerra", cost=1, effect="tempo", value=1)])
        game = GameState(size=2, players=[player, Player("B")])
        game.provinces = [Province(owner="A", cells=[(0, 0)], resource_type="wood", unit=Unit(kind="soldier", level=1, hp=3))]

        card = player.hand[0]
        played = game.play_card("A", card, province_index=0)

        self.assertTrue(played)
        self.assertEqual(game.provinces[0].unit.hp, 4)

        game.end_turn()
        self.assertEqual(game.provinces[0].unit.hp, 5)
        self.assertEqual(player.mana, 3)

    def test_resource_card_adds_player_resource(self):
        player = Player("A", mana=3, hand=[Card(name="Mineração", cost=1, effect="resource", value=2, target="stone")])
        game = GameState(size=2, players=[player, Player("B")])

        card = player.hand[0]
        played = game.play_card("A", card)

        self.assertTrue(played)
        self.assertEqual(player.resources["stone"], 2)
        self.assertEqual(player.mana, 2)

    def test_start_turn_collects_resources_from_provinces(self):
        player = Player("A", mana=1, deck=[Card(name="Furtar", cost=1, effect="attack", value=1)])
        game = GameState(size=2, players=[player, Player("B")])
        game.provinces = [Province(owner="A", cells=[(0, 0)], resource_type="wood"), Province(owner="A", cells=[(1, 0)], resource_type="stone")]

        game.start_turn()

        self.assertEqual(player.resources["wood"], 1)
        self.assertEqual(player.resources["stone"], 1)
        self.assertEqual(player.mana, 2)

    def test_game_over_is_detected_when_player_hp_reaches_zero(self):
        player_a = Player("A", hp=3)
        player_b = Player("B", hp=20)
        game = GameState(size=2, players=[player_a, player_b])

        player_a.hp = 0

        self.assertTrue(game.is_game_over())
        self.assertEqual(game.winner(), player_b)

    def test_province_can_evolve_into_fortress_when_through_growth(self):
        player = Player("A", mana=5, hand=[Card(name="Fortaleza", cost=1, effect="fortify", value=3)])
        game = GameState(size=2, players=[player, Player("B")])
        game.provinces = [Province(owner="A", cells=[(0, 0)], resource_type="wood", unit=Unit(kind="recruit", level=1, hp=3))]

        game.play_card("A", player.hand[0], province_index=0)
        player.hand.append(Card(name="Fortaleza", cost=1, effect="fortify", value=3))
        game.play_card("A", player.hand[-1], province_index=0)

        self.assertEqual(game.provinces[0].unit.kind, "fortress")
        self.assertEqual(game.provinces[0].unit.level, 2)
        self.assertEqual(game.provinces[0].unit.hp, 9)

    def test_state_summary_reports_turn_and_player_state(self):
        player_a = Player("A", mana=2, hp=15, resources={"wood": 1, "stone": 0, "food": 0, "knowledge": 0})
        player_b = Player("B", mana=3, hp=20)
        game = GameState(size=2, players=[player_a, player_b])
        game.provinces = [Province(owner="A", cells=[(0, 0)], resource_type="wood", unit=Unit(kind="recruit", level=1, hp=3), protected_turns=1, tempo_bonus=2)]

        summary = game.get_state_summary()

        self.assertEqual(summary["turn"], 1)
        self.assertEqual(summary["current_player"], "A")
        self.assertEqual(summary["players"][0]["hp"], 15)
        self.assertEqual(summary["provinces"][0]["tempo_bonus"], 2)
        self.assertFalse(summary["game_over"])
        self.assertIsNone(summary["winner"])

    def test_render_board_shows_player_initials_for_closed_cells(self):
        game = GameState(size=2, players=[Player("A"), Player("B")])
        game.play_edge("A", (0, 0), (0, 1))
        game.play_edge("A", (0, 1), (1, 1))
        game.play_edge("A", (1, 0), (1, 1))
        game.play_edge("A", (0, 0), (1, 0))

        rendered = game.render_board()

        self.assertIn("+---+", rendered)
        self.assertIn("| A |", rendered)


if __name__ == "__main__":
    unittest.main()
