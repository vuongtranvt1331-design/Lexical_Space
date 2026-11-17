# LexicalSpace release conventions

These instructions apply to this LexicalSpace project.

- After every code update, refresh the last-updated date in the side-menu footer in index.html to the actual release/edit date, using Asia/Saigon time.
- Use X.Y.z versions. Changes without a side-menu redesign are miniupdates: increment Y and reset z to 0.
- For a release that changes the side menu and adds features, increment X and reset Y and z to 0.
- Bug-fix-only releases increment z and show the word hotfix alongside the version in the footer/release notes. Keep package.json/package-lock.json versions numeric X.Y.z.
- Keep the footer version, build/file reference, package version and lockfile root version consistent. Refresh service-worker cache VERSION/CORE when app-shell assets change.
- Current release: 43.19.0 with automatic mouse/touch switching in Sky, raster action menus across Arcade and all three games; side-menu layout preserved; dated 2026-11-18.
- Never clear user storage, unregister the service worker, or purge all origin caches as an update step.
- Commit/push only when the user requests it.


SpaceSuite integration conventions:
- index.html remains the LexicalSpace entry point. apps/grammar,apps/arcade,apps/quick-drawn,apps/sky-dominators,apps/poker are pages in the SAME installed application. Keep all internal routes under the deployment base; use SpaceSuite.href/safeReturn, never hardcode an external repo or target=_blank for app navigation.
- suite/js/core.js is navigation/profile glue only. Existing sessionStorage ls_active_profile (including empty sign-out) takes priority over vocab_user and stale URL user. Do not add DB migrations or vocabulary writes from games.
- js/features/loading.js is the single canonical silent loader for Lexical,Grammar,Arcade. Child modules signal spacesuite:ready, Lexical keeps lexicalspace:ready. Readiness ends the loader immediately; do not reintroduce startup audio or mandatory animation delays.
- Preserve existing schemas and cloud boundaries: LexicalSpaceDB version3 remains owned by Lexical; games read words only. Grammar keeps its current local lesson/progress schemas. QuickDrawn keeps home-page-d6c39 standings and existing result dedupe. Sky retains skydominators progress backend. Do not silently migrate anonymous grammar progress or merge cloud providers.
- One root manifest and worker; retain existing id/start_url/scope values. Worker retires only its own old scoped shell caches, never user storage or all origin caches. Heavy game media caches on use. No automatic reload in a running match.
- QuickDrawn preserves47IDs and its selected Vươngấn logo is lobby-only, never in a match. See docs/suite-baseline.json and README-SUITE.md before future updates.

Before future edits, compare affected file hashes with docs/suite-baseline.json. Use tools/build-suite.py to refresh shared asset URLs and the worker after editing. Keep the app's id/start_url/scope and deployment address stable so existing installations can update. Never use a reinstall/storage reset as an update step. The launcher must probe a WORKING Python, not just the presence of py.exe.

Embedded QuickDrawn contracts carried from its audited source:
- index.html/js/duel.js is the hero game; the integrated cowboy entry and game.js have been retired. Active play reads all valid account words; legacy defaults to mastered only. Do not alter external LexicalSpaceDB ownership/version semantics.
- PvC is unlimited survival with its shrinking per-question countdown. Settle once at 0 HP, freeze target max(5,8+floor((startingElo-1000)/100)) at match start; enough correct answers earns a positive Elo win, otherwise a loss. Preserve deck weighting, best survival record and all standings field sets.
- Vocabulary PvP protocol13 and chess quickdrawn-chess/version2 remain distinct. Both humans click Ready. Room colors swap on rematch while host/guest actor indices and room wins remain independent of color. Spectators use the same4digit code and never send moves or write standings.
- Preserve the reconnect/30second adjudication flow, result dedupe and paired standings settlement. Shared metadata.username and words remain read-only; existing game-scoped standings/results writes remain the only game cloud writes. No Firebase Auth/rule migration.
- Chess uses existing avatars/pieces, actor-owned captures FROM the opponent, horizontal recent moves2x4 and portrait clock ABOVE equal-size ROOM WIN SCORE. Result dialog only Rematch/Exit, rematch waiting overlay keeps the board. Logo is never visible during any match.
- Teacher Vương's slipper is melee; normal attack has3 punch cues but1HP damage, lethal0HP alone uses1slap. Normalize his source orientation per pose (attack right, other rows left), not a global flip.
- This integration did not edit any QuickDrawn JS, CSS or game image/audio bytes. Its HTML only receives shared app resources and a lobby-only return link. Keep established DOM IDs and relative order of original scripts/styles.


2026-11-18 approved SpaceSuite follow-up supersedes older branding/intro/legacy notes:
- Current version 43.19.0; retain the installed manifest identity and all core vocabulary/storage/cloud ownership.
- Arcade uses approved logo A cards and looping Previous/Next/swipe, without pagination dots. Approved logo B is for game menu/lobby. Loading all three games reuses the SAME Arcade logo URL, waits for local bootstrap/assets, has no intro sound/minimum delay, and only pulses 3px. Sky cinematic is retired.
- Shared icons are the approved 24-frame atlas in apps/arcade/assets/ui_spritesheet.png. Text labels stay HTML. Poker shows its logo in the submenu only. All three main-menu columns end with a labeled Arcade Hub link. Poker deals only after Enter the Casino or Play Again. The chess personal menu leaves both clocks and the room running.
- Poker dealer picks a random unmatched opponent card; student answers from lower hand, 5 initial chips, win >=12, loss on a wrong answer leaving 0 chips, correct +1/wrong -2, one +1 two-match streak per round and +2 perfect four-match bonus. Meaning ~1.2s and cancellable English speech. Card set 2 is horizontal, with four face suits + one back; use exact integer source rectangles.
- Poker Hint/Reshuffle each cost two in-match chips on any playable turn. Spending the last two is nonlethal. Legacy per-profile assist records are dormant and left untouched. No vocabulary/IDB/cloud writes.
- User authorized permanent removal of verified orphan/legacy files AFTER the new feature graph was stable. Old cowboy entry and Sky cinematic/dev previews are retired; do not restore their imports or artwork. Current core tests/build tools/licenses and dynamic catalogs remain.
- Before future targeted edits, consult docs/suite-baseline.json and the current architecture delta. Historical audit snapshots are read-only history, not a list of files to re-create.
