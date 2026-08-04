# Hexa Octarina Conquer — v0.1.0

Status: RELEASE CANDIDATE ACCEPTED — FINAL PRODUCTION RECHECK PENDING

Target main SHA before release-notes merge: `daa983a263e7892880ee5885c7cb8cae768352be`
Certified runtime baseline: `38b3c59890f6efaadac1d43f10a0410640b7b0e6`
Production: `https://hexa-octarina-conquer.onrender.com`

## Release scope

HOC v0.1.0 is the first formal release candidate promoted after the certified RC and PLAYTEST 01 acceptance.

### Campaign
- 3 chapters and 12 progressive missions.
- Board progression from 4×4 through 7×7.
- Iniciante, Tático and Mestre difficulty progression.
- Advanced objective integrity coverage including captures, cell lead, largest province and duel-card objectives.
- Authoritative mission result, stars, unlock progression and replay/mastery preservation.
- Campaign completion state and Octarina Absoluta epilogue after 12/12 missions.
- Final achievement recognition only when unlocked by authoritative campaign state.

### Gameplay and authority
- First Playable complete.
- Gameplay and balance release gates complete.
- Authoritative Node server, Python reference engine and Godot client matrix covered.
- PostgreSQL persistence, identity, XP idempotency and campaign progress reload covered.
- Advanced Chapter 3 lifecycle (`c3-m2 — Trono Fragmentado`) covered in the official Single Player Campaign CI workflow.

### PACK 99 and presentation
- Canonical PACK 99 production gate previously certified at 1037/1037 canonical and 1037/1037 materialized assets.
- Web/PWA, Visual QA and PACK 99 runtime validation covered in the RC matrix.
- Mobile campaign deferred rendering validated by real 390×844 viewport scrolling; the prior blank full-page panels were confirmed as a capture artifact, not a product regression.

### PLAYTEST 01 result
- P0 reproducible product blockers: 0.
- P1 reproducible product blockers: 0.
- Campaign mobile rendering: PASS.
- Campaign persistence/reload: PASS.
- Replay/mastery preservation: PASS.
- Advanced objective lifecycle: PASS.
- Chapter 3 advanced mission lifecycle: PASS in official CI.

## Freeze and release policy

No new gameplay, campaign, UI, content or asset feature is included after RC certification. Changes between the certified runtime baseline and the release target are limited to QA workflows, test coverage, playtest documentation and test-runner isolation.

Publication of v0.1.0 remains blocked until the canonical production verification is repeated against the published deployment and returns:

`PRODUCTION_GATE=PASS canonical=1037 materialized=1037`

After that proof, v0.1.0 may be tagged and published as the first formal HOC release.

Tehkné Solutions
