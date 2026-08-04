# PLAYTEST 01 — Entry criteria

The controlled public playtest starts only from the certified RC already published and proven by the production gate.

## Certified baseline

- application SHA: `38b3c59890f6efaadac1d43f10a0410640b7b0e6`
- certification record merged through PR #261
- PACK 99 production gate: `PASS`
- canonical assets: `1037/1037`
- materialized assets: `1037/1037`

## Rules

1. Do not add features during PLAYTEST 01.
2. Record reproducible findings before changing code.
3. P0/P1 fixes must be isolated as release blocker hotfixes.
4. P2 findings stay in the post-RC backlog.
5. Any hotfix must rerun the affected matrix and the production gate.
6. Screenshot-only findings are candidates until reproduced in the published build or a production-equivalent viewport.

## Minimum user journey

Home → Campaign → mission selection → gameplay → AI turn → combat → mission outcome → progress persistence.

Tehkné Solutions
