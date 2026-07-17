import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from hexa_octarina_conquer.cli import parse_command


class CliTests(unittest.TestCase):
    def test_parse_command_for_edge_action(self):
        self.assertEqual(parse_command("edge 0 0 1 0"), ("edge", ((0, 0), (1, 0))))

    def test_parse_command_for_state_action(self):
        self.assertEqual(parse_command("state"), ("state", ()))


if __name__ == "__main__":
    unittest.main()
