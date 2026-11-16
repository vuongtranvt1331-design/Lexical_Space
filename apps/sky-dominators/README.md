# Sky Dominators

Production game files, including the latest Boss 5 update.

## Run locally

Install Node.js 18 or newer, then double-click `start-local.bat` on Windows. On macOS use `start-local.command`; on Linux run `sh start-local.sh`. Alternatively run `npm start` from this folder. No dependency installation is required.

The launcher opens the game at a local address and keeps it available until the terminal is closed.

## GitHub Pages

Place the contents of this folder at your existing game repository's publishing root. Keep `index.html`, `.nojekyll`, `css/`, `js/` and `assets/` together. Configure Pages to publish that root. No build step is required.

The game keeps its existing Firebase configuration and player-data logic. Cloud features require internet access. This folder contains no player database export, test pages, test reports, logs or backups.

## Structure

- `index.html`: main game entrypoint.
- `css/`: menu and game styles.
- `js/`: game systems, aircraft, bosses, skins and persistence.
- `assets/`: referenced artwork, animation frames and audio.
- `tools/dev-server.cjs` and `start-local.*`: local startup helpers.

Release: 2026-11-01-boss5-phases-1.
