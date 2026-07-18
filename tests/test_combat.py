import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from hexa_octarina_conquer import Card, DuelCombatant
from hexa_octarina_conquer.combat import apply_sequence, elemental_multiplier


class CombatTests(unittest.TestCase):
    def test_elemental_advantage(self):
        self.assertEqual(elemental_multiplier("water", "fire"), 1.5)
        self.assertEqual(elemental_multiplier("physical", "water"), 1.0)

    def test_shield_absorbs_damage(self):
        attacker = DuelCombatant("A", hp=10, max_hp=10, energy=3)
        defender = DuelCombatant("B", hp=10, max_hp=10, energy=3, shield=3)
        apply_sequence(attacker, defender, [Card("Ataque", 1, "attack", value=5)])
        self.assertEqual(defender.shield, 0)
        self.assertEqual(defender.hp, 8)

    def test_sequence_validation_is_atomic_for_energy(self):
        actor = DuelCombatant("A", hp=10, max_hp=10, energy=1)
        target = DuelCombatant("B", hp=10, max_hp=10, energy=3)
        with self.assertRaises(ValueError):
            apply_sequence(actor, target, [Card("Caro", 2, "attack", value=9)])
        self.assertEqual(actor.energy, 1)
        self.assertEqual(target.hp, 10)


if __name__ == "__main__":
    unittest.main()
