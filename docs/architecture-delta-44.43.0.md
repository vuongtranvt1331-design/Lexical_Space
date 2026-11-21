# Dock Nine campaign and fleet arrival

The main campaign covers six encounters. Kite diverts twelve fleet-yard power cores to Dock Nine after its air pumps and main transmitter lose power. Sector checkpoints escalate to a pursuit by Admiral Oren Veyr. The harbor crew, a rescued skipper and a mine tender intervene on the public frequency. The neutral shopkeeper offers a berth. A scrambled fleet-command transmission interrupts the approach to the asteroid belt. In solo play, reading it pauses asteroid movement and typing deadlines.

Each radio line names its speaker in dock-nine-story.js. The 240 × 96 indexed PNG contains nine 48 × 48 faces and one opaque silhouette tile for the intercepted voice. The canvas uses nearest-neighbor sampling at twice native size. Escort One is the watch officer on the rescue channel.

After the sixth reactor sequence and pilot escape, the rescue channel closes. An empty stretch of space lasts 2.2 seconds before the nine-ship, 6.8-second fleet arrival. Two white Imperial escorts sit immediately astern of the central purple dreadnought, with a smaller purple ship behind to port. In 44.48.0 the flagship starts its jump at 3.67 seconds on the fleet clock and reaches its arrival size on the sound impact at 3.87 seconds. Each hull uses the existing jump recording and its own pan, gain and arrival time. Malrec appears in full after the fleet arrives. He hears Veyr’s account, strips him of command, orders him to stand trial before his captains and addresses Kite. Advancing the last line settles the flight result and returns to the hangar. Both modes play the fleet arrival. In co-op the arrival settles the result automatically. Numbered encounters 7–10 and Boss Rush remain separate training activities in Boss Lab.

The serialized flight stores the current radio scene and line alongside its phase. Co-op advances past transmissions in the shared simulation step, including when a restored checkpoint contains a solo-era radio phase. The fleet uses simulation time in the campaign and its audio clock in standalone Lab preview. Campaign checkpoints from beyond the chapter boundary resume at the fleet arrival. Read-only vocabulary access and existing profile result fields are preserved.

## Radio Log and fleet lighting in 44.44.0

The hangar Radio Log reads every scene and speaker from SpaceStory. Each transmission opens independently, and Expand all shows the complete transcript including the training response. The unidentified voice uses its silhouette tile. Back or Escape restores focus to the hangar control.

The white escorts stage at (450, 235) on the port side and (759, 199) on starboard. Lighting is baked into four in-memory hull canvases when the sprites load. In hotfix 44.44.1, a neutral shadow peaks just starboard of the central ridge at mid-hull and falls away toward both the outer wing and the stern. Preview and campaign share the cached artwork and formation.

## Flight radio and fleet lighting in 44.45.0

Solo transmissions place the speaker portrait and subtitles directly on the flight scene. The opening map has been removed. The speaker's name is blue for allies, red for the Empire, and cream for the independent shopkeeper. The hangar Radio Log uses the same colors. Co-op skips every story transmission in the campaign and Boss Lab. Shops, the asteroid-belt encounter, fleet cinematics and the final result advance through their normal gameplay transitions.

All four hull designs in the final nine-ship formation use a neutral shadow. Its opacity peaks at 65% just right of the central ridge and tapers toward the outer starboard wing and stern. Both the chapter ending and Boss Lab 11 draw the same cached hulls.

## Imperial gate patrol and dialogue settings in 44.46.0

The three destroyers in the launch cinematic are permanent gate guards. Two timed radio lines accompany the existing deployment. The subsequent distress call explains the explosion, the five thousand residents and Gate Control’s refusal to release Kite’s cargo. The convoy delivers its cores after the sixth encounter. The Radio Log includes the patrol exchange as well as the campaign transmissions.

Hangar and pause Settings use the same two-by-two layout. Volume and Dialogue occupy the first row, Control and Back the second. Dialogue defaults to on for solo flights and Boss Lab. The local key `space_dominators_dialogue_v1` records the pilot’s choice separately from effects volume. Co-op always skips dialogue on both seats. Switching dialogue off during a paused transmission advances to its destination when the simulation resumes.
