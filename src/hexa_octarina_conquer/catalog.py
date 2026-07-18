from __future__ import annotations

from typing import List

from .cards import Card


def starter_deck() -> List[Card]:
    """Small deterministic deck used by the CLI and integration tests."""

    return [
        Card("Expansão Rúnica", 1, "conquest", description="Ergue uma aresta válida."),
        Card("Alquimia Arquitetônica", 2, "evolve", value=1, description="Evolui a unidade da província."),
        Card("Fortaleza Octarina", 1, "fortify", value=3, description="Fortalece uma província aliada."),
        Card("Muro de Espinhos", 1, "trap", value=2, description="Protege uma província contra cerco."),
        Card("Convocar Duelo", 1, "duel", value=0, description="Inicia um duelo por uma província inimiga."),
        Card("Maré Rúnica", 1, "status", status="wet", duration=2, element="water"),
        Card("Raio Encadeado", 2, "attack", value=3, element="electric"),
        Card("Égide de Pedra", 1, "shield", value=2, element="physical"),
        Card("Cura Alquímica", 1, "heal", value=2, element="plant"),
        Card("Avanço de Era", 1, "advance_era"),
    ]
