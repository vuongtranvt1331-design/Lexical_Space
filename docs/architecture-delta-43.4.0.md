# SpaceSuite 43.4.0 — targeted architecture delta

Primary root remains LexicalSpace-project. This delta supersedes the historical 43.3.0 inventory ONLY for the files/features below. Current complete source hashes, IDs and ordered entry dependencies are in suite-baseline.json. The old full architecture audit remains historical context; never restore an intentionally pruned file just because it appears there.

| Feature | Owner and dependencies |
|---|---|
| Arcade game selection | apps/arcade/index.html → css/arcade-1.css, js/arcade-2.js; original20IDs, native vocabulary/topic selectors, same routing/helper. Previous/Next/keyboard/edge-swipe wrap without cloned cards or pagination dots. |
| Approved art | Logo A: apps/arcade/assets/logo/*_logo.png, Farm coming-soon PNG, Arcade master logo. Logo B remains only in Sky menu and Word Battles lobby. Poker has no persistent logo. |
| Shared game loading | suite/components/game-logo-loader.js + suite/css/game-logo-loader.css; three game entries use exact Arcade logo URLs. Image-only 3px pulse, local readiness + image decode + window load gates, no minimum wait/audio,8s fail-open, original inert/focus restoration. Lexical/Grammar/Arcade still use the existing silent typing loader. |
| Local readiness | Sky js/app.js signals after assets/vocabulary/menu before original RAF; Word js/duel.js append-only bootstrap waits hero/map/CombatAnimator art and local UI promises; Poker initGame waits words plus dealer/elements/cards/icons. Remote standings/PeerJS do not gate startup. |
| Common icons | apps/arcade/assets/ui_spritesheet.png is384×256,24 cells64×64. Arcade/Poker own mappings; suite/css/game-icons.css maps Sky/Word common controls. Original labels/IDs/handlers remain. Chess-specific Resign/Draw retain their original artwork. |
| Poker matching | apps/poker/js/poker-1.js: handleCardSelect, resolveCorrectTurn, resolveIncorrectTurn, awardCompletedRound, completeCurrentRound, triggerTerminalEnding. Any unresolved card can be first; same-card toggles selection, same-hand reselects, opposite-hand checks.5start/+1correct/−1wrong/win>=12/loss0; one +1streak per hand, +2perfect hand. Meaning1200ms, cancelable local English speech, escaped mistake recap. |
| Poker assets/rendering | apps/poker/css/poker-1.css, index.html and JS. Detailed dealer PNG1536×2304:4columns×6poses,384cells. Selected card set2 PNG3840×480: five768×480 cells diamond/spade/club/heart/back. Integer source offsets and transparent padding; only destination scales;8:5landscape cards, live words/meaning remain HTML. Old duplicate vector/pip/rank ornaments removed. |
| Poker assists | earnedAssistUses/readAssistProgress/reserveAssist/recordCompletedRound. Owned localStorage key wildWestPoker_assists_v1:<encoded frozen profile>. Fields version:1,completedRounds,consumedHint,consumedReshuffle. First free Hint+Reshuffle at10 completed four-pair rounds, then30/50/70…; unused credits carry separately. Reshuffle needs4other words, abandons rather than completes current hand. No chip cost. |
| Cache/build | tools/build-suite.py → service-worker.js and suite/release.json. Version43.4.0; installed manifest identity unchanged. The3Hub logo content hashes contribute to shell version; once viewed they are reused from the current shell without another network request. Other media keeps the prior refresh policy. Logos are NOT added to install precache; no reload during matches or data clearing. |
| Verified dead sections | QuickDrawn audio.js retains EXACT original CombatAudio suffix; sprite-animator.js retains EXACT original SilverSlashEffect/Projectile/CombatAnimator suffix. Cowboy-only classes/globals and lobby legacy link retired. Five private unused Arcade audio methods removed; active Settings mute/click/coin unchanged. Poker unused sequential shim/flag and decorative CSS/helpers removed. |

## Data and immutable boundaries

LexicalSpaceDB remains version3 and Lexical-owned; all game vocabulary access stays readonly. Core IDB/sync/SRS, suite/js/core.js, Firebase/Firestore projects, standings/Elo fields, PeerJS protocols, recovery/rematch and chess rules are unchanged. No schema migration or production data writes. Original static IDs remain Arcade20/Word47/Sky111/Poker31; Sky retains65script slots, with old intro slot replaced by shared loader.

## Pruning

68 verified orphan/legacy files were deleted ONLY after feature tests and real browser checks passed. Removed file bytes:13,173,297. Full path/byte/SHA/reason list is in the external delivery report outputs/space-suite-final/deleted-files.json and CSV. Old cowboy page/code/art, Sky cinematic/dev previews, unused source canvases/specs/helper scripts and superseded startup/brand assets are retired.876catalog skin files,86boss assets,24current test files,teacher admin, licenses and foundation docs remain. Runtime authoring specs are kept in review/audit outputs, not shipped when no runtime fetch uses them.

No standalone source folder was edited by this cleanup. No push/deployment was performed.
