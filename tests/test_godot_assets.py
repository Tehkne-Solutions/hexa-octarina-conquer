import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GODOT = ROOT / "client" / "godot"


class GodotAssetTests(unittest.TestCase):
    def test_project_points_to_existing_3d_arena(self):
        project = (GODOT / "project.godot").read_text(encoding="utf-8")
        match = re.search(r'run/main_scene="res://([^"]+)"', project)
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), "scenes/arena_3d.tscn")
        self.assertTrue((GODOT / match.group(1)).is_file())
        self.assertIn("pointing/emulate_mouse_from_touch=true", project)
        self.assertIn('window/handheld/orientation=1', project)

    def test_arena_scene_references_existing_scripts(self):
        scene = (GODOT / "scenes" / "arena_3d.tscn").read_text(encoding="utf-8")
        script_paths = re.findall(r'path="res://([^"]+\.gd)"', scene)
        self.assertEqual(
            sorted(script_paths),
            [
                "scripts/account_ui.gd",
                "scripts/arena_3d.gd",
                "scripts/battle_ui.gd",
                "scripts/combat_fx.gd",
                "scripts/network_session.gd",
            ],
        )
        for script_path in script_paths:
            self.assertTrue((GODOT / script_path).is_file(), script_path)

    def test_arena_contains_required_runtime_nodes(self):
        scene = (GODOT / "scenes" / "arena_3d.tscn").read_text(encoding="utf-8")
        for node_name in (
            'name="NetworkSession"',
            'name="BoardRoot"',
            'name="CombatFX"',
            'name="BattleUI"',
            'name="AccountUI"',
            'name="Camera3D"',
            'name="DirectionalLight3D"',
            'name="HUD"',
        ):
            self.assertIn(node_name, scene)

    def test_client_uses_private_state_cards_and_accounts(self):
        network = (GODOT / "scripts" / "network_session.gd").read_text(encoding="utf-8")
        arena = (GODOT / "scripts" / "arena_3d.gd").read_text(encoding="utf-8")
        battle_ui = (GODOT / "scripts" / "battle_ui.gd").read_text(encoding="utf-8")
        account_ui = (GODOT / "scripts" / "account_ui.gd").read_text(encoding="utf-8")
        effects = (GODOT / "scripts" / "combat_fx.gd").read_text(encoding="utf-8")
        scene = (GODOT / "scenes" / "arena_3d.tscn").read_text(encoding="utf-8")

        self.assertIn('const PROTOCOL_VERSION := "1.0"', network)
        self.assertIn('"player.private_state"', network)
        self.assertIn('"account.register"', network)
        self.assertIn('"leaderboard.list"', network)
        self.assertIn('"match.forfeit"', network)
        self.assertIn('"action.play_card"', network)
        self.assertIn('"action.resolve_duel_round"', network)
        self.assertIn("func _build_provinces", arena)
        self.assertIn("signal duel_submitted", battle_ui)
        self.assertIn("func _on_leaderboard_changed", account_ui)
        self.assertIn("func play_duel_impact", effects)
        self.assertIn("AudioStreamWAV", effects)
        self.assertIn("Tehkné Solutions", scene)

    def test_battle_ui_preserves_public_private_boundary(self):
        network = (GODOT / "scripts" / "network_session.gd").read_text(encoding="utf-8")
        self.assertIn("var room_state: Dictionary", network)
        self.assertIn("var private_state: Dictionary", network)
        self.assertIn("private_state_changed.emit", network)
        self.assertNotIn("session_token\"", (GODOT / "scripts" / "battle_ui.gd").read_text(encoding="utf-8"))

    def test_android_export_preset_has_mobile_identity_and_network_permissions(self):
        preset = (GODOT / "export_presets.cfg").read_text(encoding="utf-8")
        self.assertIn('platform="Android"', preset)
        self.assertIn('package/unique_name="com.tehkne.hexaoctarina.mobile"', preset)
        self.assertIn('name="Android"', preset)
        self.assertIn('name="Android ARMv7"', preset)
        self.assertIn('architectures/arm64-v8a=true', preset)
        self.assertIn('architectures/armeabi-v7a=true', preset)
        self.assertIn('permissions/internet=true', preset)
        export_script = (ROOT / "scripts" / "export-android.sh").read_text(encoding="utf-8")
        self.assertIn("--export-debug Android", export_script)
        self.assertIn("Tehkné Solutions", export_script)


if __name__ == "__main__":
    unittest.main()
