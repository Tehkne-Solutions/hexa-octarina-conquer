# PLAYTEST 01 — Visual evidence pass

RC certified production application SHA: `38b3c59890f6efaadac1d43f10a0410640b7b0e6`  
Certification record merge: `6c51ed1d694f38402f33f2a6804af502db97009c`

Evidence source: GitHub Actions `Visual QA Matrix #298`, artifact `hexa-octarina-visual-qa` (head SHA `52c09ce60475bb37dfa13b99682237f1927c3084`). The hotfix represented by that SHA only changes RC certification guards, not campaign/gameplay UI.

## Flow evidence reviewed

- Home — 1366×768
- Campaign — 1366×768
- Gameplay — 1366×768
- Combat selection — 1366×768
- Combat impact — 1366×768
- Outcome — 1366×768
- Home — 390×844
- Campaign — 390×844
- Gameplay — 390×844

## Result

Desktop journey is visually present from Home through campaign, gameplay, combat selection/impact and outcome.

Mobile Home and mobile gameplay are populated and readable in the captured evidence.

### P1 candidate — mobile campaign tail contains blank chapter-sized panels

In `campaign-mobile-390x844.png`, after the visible Prologue and Chapter 1 cards, the full-page capture contains two large bordered campaign panels with no visible title, mission node, copy or action. The corresponding desktop capture `campaign-notebook-1366x768.png` renders Chapters 2 and 3 with their artwork, title, progress and locked mission node.

This is classified as a **P1 candidate** because, if reproduced on a real mobile production viewport, later campaign chapters can become visually unavailable/ambiguous even though desktop rendering is intact.

No RC hotfix is authorized from screenshot evidence alone. The finding must first be reproduced against the published production URL on a real/equivalent 390×844 viewport. If production does not reproduce it, close as capture-only artifact. If production reproduces it, treat it as a mobile release blocker hotfix and rerun Visual QA, Web Mobile PWA, Single Player Campaign and Production Gate.

Tehkné Solutions
