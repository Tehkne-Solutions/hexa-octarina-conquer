from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Tuple

from .cards import Card
from .models import DuelCombatant

ELEMENT_ADVANTAGE = {
    ("fire", "plant"): 1.5,
    ("plant", "water"): 1.5,
    ("water", "fire"): 1.5,
    ("magitech", "physical"): 1.5,
}


@dataclass
class CombatRoundResult:
    first_actor: str
    log: List[str]


def elemental_multiplier(attacking_element: str, defending_element: str) -> float:
    return ELEMENT_ADVANTAGE.get((attacking_element, defending_element), 1.0)


def validate_sequence(actor: DuelCombatant, cards: Iterable[Card]) -> None:
    total_cost = sum(card.cost for card in cards)
    if total_cost > actor.energy:
        raise ValueError(f"not enough duel energy for {actor.player_name}")


def _deal_damage(target: DuelCombatant, damage: int) -> Tuple[int, int]:
    absorbed = min(target.shield, damage)
    target.shield -= absorbed
    actual = max(0, damage - absorbed)
    target.hp = max(0, target.hp - actual)
    return absorbed, actual


def apply_sequence(actor: DuelCombatant, target: DuelCombatant, cards: List[Card]) -> List[str]:
    validate_sequence(actor, cards)
    actor.energy -= sum(card.cost for card in cards)
    log: List[str] = []

    for card in cards:
        if actor.hp <= 0:
            break

        if card.effect == "shield":
            actor.shield += card.value
            log.append(f"{actor.player_name} gains {card.value} shield with {card.name}")
            continue

        if card.effect == "heal":
            before = actor.hp
            actor.hp = min(actor.max_hp, actor.hp + card.value)
            log.append(f"{actor.player_name} heals {actor.hp - before} with {card.name}")
            continue

        if card.effect == "status":
            if not card.status:
                raise ValueError("status cards require a status name")
            target.statuses[card.status] = max(1, card.duration or 1)
            log.append(f"{actor.player_name} applies {card.status} with {card.name}")
            continue

        if card.effect == "attack":
            multiplier = elemental_multiplier(card.element, target.element)
            if card.element == "electric" and target.statuses.get("wet", 0) > 0:
                multiplier *= 2.0
            damage = max(0, round(card.value * multiplier))
            absorbed, actual = _deal_damage(target, damage)
            log.append(
                f"{actor.player_name} uses {card.name}: {actual} damage"
                + (f" ({absorbed} absorbed)" if absorbed else "")
            )
            continue

        raise ValueError(f"unsupported duel card effect: {card.effect}")

    return log


def tick_statuses(combatant: DuelCombatant) -> None:
    expired = []
    for status, turns in combatant.statuses.items():
        remaining = turns - 1
        combatant.statuses[status] = remaining
        if remaining <= 0:
            expired.append(status)
    for status in expired:
        del combatant.statuses[status]


def resolve_round(
    attacker: DuelCombatant,
    defender: DuelCombatant,
    attacker_cards: List[Card],
    defender_cards: List[Card],
    attacker_initiative: bool,
) -> CombatRoundResult:
    validate_sequence(attacker, attacker_cards)
    validate_sequence(defender, defender_cards)

    order = [
        (attacker, defender, attacker_cards),
        (defender, attacker, defender_cards),
    ]
    if not attacker_initiative:
        order.reverse()

    log: List[str] = []
    for actor, target, cards in order:
        if actor.hp > 0:
            log.extend(apply_sequence(actor, target, cards))

    tick_statuses(attacker)
    tick_statuses(defender)
    return CombatRoundResult(first_actor=order[0][0].player_name, log=log)
