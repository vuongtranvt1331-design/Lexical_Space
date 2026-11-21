# SpaceSuite 44.39.0 — Fleet arrival in Boss Lab

The Boss Lab selector includes **11. Hyperspace Fleet · Animation Lab**. The entry point is `apps/space-dominators/boss-practice.html?boss=11`. Select **Play animation**, then **Replay animation** after the preview, or use Esc or the corner exit control to return early.

The lab loads a single 416 × 234 transparent, paletted front-view hull on selection. Nine instances share its world size. Camera depth determines their apparent width, their relative approach speed and their drawing order. The game backdrop runs slowly behind them. Jumps start at 0.48–2.42 seconds and take 0.20 seconds each. The flagship arrives last, continues approaching the camera and remains in view until the lab returns at 6.8 seconds.

`fleet-study.js` owns the preview clock, projection, rendering and cleanup. It reuses the flight canvas, SpaceBackdrop and the existing volume-controlled warp cue. `boss-practice.js` routes the lab selection directly to the preview. Combat, co-op, campaign progression and rewards continue to use the ten-entry combat catalog. The new hull and script are included in the suite cache.
