# Hazard — Titan LEGEND skin

Price: **2,000 Coins**. Compatible aircraft: **Titan only**. Individual ownership ID: `titan__hazard`. Uses the game's existing purchase transactions, ownership, equip and profile persistence. Purchasing does not automatically equip it.

## Files

- `fuselage.png`: transparent 256 × 270 body, supports and stationary duct rings. All four rotor interiors are transparent.
- `rotor/frame_01.png` through `frame_04.png`: separate 64 × 64 propeller artwork.
- `projectile/frame_01.png` through `frame_04.png`: green hazard plasma shots.
- `muzzle_flash/frame_01.png` through `frame_04.png`: firing flash.
- `explosion/frame_01.png` through `frame_04.png`: impact/destruction burst.
- `flight/frame_01.png` through `frame_04.png`: assembled Hangar preview animation.
- `preview.png`: complete assembled static preview.
- `manifest.json`: geometry, pivot positions, timing and asset inventory.
- `source-body.png`, `source-effects.png`: original generated PNGs, preserved unchanged.
- `generation-prompts.json`: final prompts and built-in image_gen generation mode.

## Runtime

`js/entities/skins/hazard.js` draws the four propellers independently beneath the stationary body. Rotor poses advance at 60 FPS (5× the original rotation speed) in 15-degree steps; diagonally opposite rotors share direction. Each rotor pivots around its own hub. The main game loop supplies time; no extra animation loop or interval is created. The manifest's first rotor frame is used for rigid rotation so the blades do not change shape.

The existing skin renderer handles the four projectile frames at 80 ms each, the four muzzle frames at 40 ms each and four explosion frames at 80 ms each. Muzzle and explosion sequences play once and are removed. Player-death effects finish after game over without advancing combat.

Titan now destroys a full-health regular enemy in two valid shots. Boss damage, hitboxes, firing cooldowns, projectile speed and Titan's two independent 28-second armor recovery timers are unchanged. Hazard has a cosmetic horizontal sway of at most 1 game pixel (0, +1, 0, -1 at 125 ms per step), also shown in Hangar previews. Player coordinates and hitboxes do not move with this effect.

## Try it

Open the game's `boss-test.html`, choose **Hangar → Titan → Hazard → Equip Skin → Take Off**. Test mode makes skins available in memory only and does not save progress or spend Coins. Normal `index.html` retains the real 2,000-Coin purchase requirement.

## Validation performed

- 6 targeted logic/integrity tests passed, including two concurrent purchases through the real Firestore repository using an in-memory transactional adapter: one ownership record and one 2,000-Coin deduction.
- 20 Chrome checks passed: Hangar animation/equip, desktop/mobile portrait/mobile landscape layout, in-game propellers, native Space firing, all effect frames and cleanup, enemy destruction deduplication, Titan health/armor and player-death effect.
- 7 existing Celestial regression tests passed against this updated game.
- Body background and all four rotor-hole centers verified transparent.

No live Firebase writes, deployment or GitHub push were performed.
