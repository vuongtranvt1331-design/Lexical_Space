# SpaceSuite 43.9.0 game controls and casino menu

| Change | Files and behavior |
|---|---|
| Game menu routing | The original Hub links are the final actions in the main menu columns of Sky Dominators, Word Battles and Wild West Poker. Each app retains its existing profile-aware suite routing. |
| Raster controls | Each game and Arcade own an `assets/action-buttons.png` sheet. The shared `apps/arcade/js/action-frames.js` slices 96 × 40 px frames in four columns. `apps/arcade/css/action-frames.css` fixes the corners while live DOM labels stretch. `suite/css/game-icons.css` supplies HUD glyphs. |
| Poker entry, score and pause | `apps/poker/index.html` owns the lobby, original table IDs and pause dialog. `apps/poker/js/poker-1.js` prepares vocabulary and artwork at startup. Enter the Casino and Play Again start a fresh five-chip game. Wrong matches cost two chips, floored at zero, and defeat fires only through the wrong-answer path. Both assists still cost two and can spend the last two safely. Pause parks remaining callback delays. |
| Chess toolbar | `apps/quick-drawn/index.html`, `css/duel.css` and `js/chess.js` display Resign, a two-slot draw offer, and a framed slate Pause. The 43.10.0 toolbar uses chess_toolbar_emojis.png for the flag, handshake and pause tablets. Incoming offers split the middle slots into Yes and No. The personal menu keeps the clocks running. Ended games show Rematch and Main Menu. |
| PWA | `tools/build-suite.py` includes the button PNGs and active style and script files in the scoped shell. Existing app identity, word storage, standings and peer message formats remain in use. |

The full current ID sets, script order, checksums and data contracts are in [suite-baseline.json](suite-baseline.json).
