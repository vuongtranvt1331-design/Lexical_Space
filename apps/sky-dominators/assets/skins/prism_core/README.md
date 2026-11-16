# Flame / Prism Core — Chronos

This skin uses the supplied spacecraft and energy-spark references, reinterpreted as transparent pixel art. A fixed generated hull and generated flame/sword-ray layers are composed into **40 distinct exported frames**. The 40 frames are baked phase poses, not 40 separately redrawn aircraft, so the hull silhouette and cockpit stay fixed.

## Deliverables

- `manifest.json`: complete 40-frame mapping, source metadata, layer order, phase poses, timings and validation results.
- `../../../js/config/skins/prism-core-config.js`: runtime configuration, available as `SkyPrismCoreConfig` and CommonJS.
- `../../../js/entities/skins/prism-core.js`: ES6 `AnimationController`, atlas renderer and Hangar integration, available as `SkyPrismCore` and CommonJS.
- `frames/frame_01.png` through `frame_40.png`: transparent 416 × 416 PNG frames.
- `flight-40.png`: runtime atlas, 8 columns × 5 rows, 3328 × 2080, generated from the current artwork.
- `hull.png`: fixed transparent hull layer; `preview.png`: assembled first frame.
- `source-hull.png` and `source-vfx.png`: unchanged generated source assets.
- `generation-prompts.json`: final prompts and built-in image_gen mode.
- `preview.html`: standalone animation viewer, light/dark backgrounds, pause and frame slider. Opens directly from disk when the surrounding game folder is kept intact.

## Timing and integration

Each frame lasts **250 ms / 4 FPS**. Indices are `0..39`; exported filenames are `01..40`. The full loop is **10,000 ms**. Frames are laid out left-to-right, then top-to-bottom. Both `idle` and `movement` use the complete sequence and preserve elapsed phase on transition. The controller advances only through the existing player update loop; it creates no timer or animation loop. Pause freezes the player skin. Visual-only Hangar previews use the existing menu loop.

The renderer loads one atlas image, crops the configured rectangle and uses the same centered origin for every frame. It performs no runtime pixel readback, recoloring, canvas extraction or per-frame image loading. Pixel smoothing is disabled. Adjacent VFX poses are blended during asset export; runtime frames remain crisp and are held for 250 ms.

VFX are scaled to 170% of the original dimensions. The gothic hull keeps the 176-pixel hull height and original gameplay size; the padded frame prevents clipping. Hangar previews contain the full effect within their existing layout.

The under-ship rays now use dedicated obsidian/charcoal black-fire artwork with dark crimson embers (`source-black-fire.png`); the hull now uses obsidian gothic plating, silver ribs and crimson seams (`source-gothic-hull.png`). Original source artwork is retained.

Layer order: black-fire sword-like rays below the ship, fixed gothic hull with integrated crimson exhaust, then a restrained pulse masked to crimson hull details. Gold/orange flame overlays are no longer composited onto this theme. All 40 frame edges are transparent. Frame 40 transitions back to frame 1 without resetting the ship's pose.

The skin is compatible only with Chronos, using the existing individual ownership key `chronos__prism_core`. Price and rarity are intentionally `null` until configured; the normal Hangar permits preview and displays the existing Coming Soon state for unowned profiles. No currency, rank or ownership is granted. Existing owners can equip normally. The separate `boss-test.html` permits testing all skins without saving progress: Hangar → Chronos → Flame / Prism Core → Equip Skin → Take Off.

Chronos health, shield, row progression, active skill, cooldown, movement and weapons are not modified by this skin.

## Verification performed

- Six automated logic/integrity tests passed: 40 distinct frames and atlas cells, 250 ms timing/10-second wrap, preserved idle/movement phase, cosmetic-only player updates, Chronos-only catalog eligibility and syntax/dependency checks.
- Nineteen Chrome checks passed on the actual local game: all 40 indices rendered sequentially and wrapped, frame timing, pause, movement, Hangar equip/cleanup, desktop/mobile portrait/mobile landscape, original Chronos HP/shield/cooldown/projectile, one atlas request, standalone viewer, and no JavaScript errors or failed file assets.
- Inspected light-background preview and in-game rendering. Verified transparent borders on every exported frame.
- Tests used the isolated local boss-test profile. No live Firebase writes, deployment or GitHub push were performed.
