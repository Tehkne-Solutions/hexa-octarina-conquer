# Vertical Slice — PACK 99 visual contract

The strategic vertical slice must resolve its player-facing art exclusively through canonical PACK 99 runtime IDs.

## Rules

- No gameplay component may hard-code `/assets/runtime/packages/...` physical paths.
- Canonical aliases live in `public/assets/runtime/registry/canonical-runtime-aliases.json`.
- `runtimeAssetUrl()` is the single resolver for strategic terrain, roads, pillars, props, structures and combatants.
- Missing assets are treated as a release-readiness defect, not as a permanent visual fallback.

## Current combatants

- Kael → `HERO_GUARDIAN_01_IDLE_BASE_SW_01`
- Lyra → `HERO_RANGER_01_IDLE_BASE_NE_01`
- Varg → `UNIT_RECRUIT_01_IDLE_BASE_NW_01`
- Brakk → `CHAMP_BERSERKER_01_IDLE_BASE_NW_01`

Tehkné Solutions
