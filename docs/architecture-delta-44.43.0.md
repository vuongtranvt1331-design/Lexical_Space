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

## Co-op lives in 44.49.0

Both players draw from one life pool. A co-op mission or Boss Lab starts at six, with a maximum of eight. A hit deducts from the team and respawns the ship hit. Its pilot gets one second of grace on re-entry. Two independent hits can spend two lives. A missed asteroid ends the attempt and costs one shared life. Either player can buy a team life at the dock for 100 credits. Solo starts at three and caps at four.

The lead pilot stores remaining lives. The wingmate exposes the same value to targeting and damage effects. Co-op checkpoint version 2 carries the current total through replay and reconnect. Loading a version 1 room sums the two personal reserves once. Peer protocol 5 keeps peers using different damage rules out of the same simulation. Tempest records the firing ship’s coordinates for its pulse.


## Space Dominators pilot abilities in 44.50.0

The hangar and the flight HUD read the same ability definitions. Kestrel slows hostile projectiles to half speed for four seconds with a twelve-second cooldown. Fleet movement, weapon warnings and boss attack schedules continue at their usual pace. Tempest clears live projectiles and detached beacon waves once per activation, with an eighteen-second cooldown. Anchored beams, mines and ships remain active.

Spectre locks one vocabulary fleet by its stable formation ID. Its missiles follow individual targets and count one fleet toward the next encounter. Automated clears earn neither vocabulary points nor fleet credits. The twenty-eight-second salvo does up to two percent of a conventional boss's maximum hull, once per cast, subject to exposure and armor. On the dreadnought deck, each of up to six missiles deals three damage to one fighter or destructible turret. Reactor timing and asteroid typing retain priority over abilities.

Aegis starts each mission with one point of passive armor for the solo pilot or the entire co-op team. Absorbing a hit starts sixty seconds of combat recharge. Excess damage costs lives immediately. A second Aegis shares the charge and timer. Peer protocol 6 replays casts and their impacts from ordered inputs. Snapshots include live salvos, the slow field and the remaining armor recharge. Older checkpoints initialize these new fields on load.

## Space Dominators player hull art in 44.51.0

The hangar, flight scenes and Boss Lab draw the same four transparent hulls. Each occupies a 64 by 64 logical pixel cell with 11 to 13 opaque colors. The 1024 by 256 PNG stores four nearest-neighbor enlargements in Kestrel, Spectre, Aegis and Tempest order. The renderer mounts the existing four-frame exhaust strip over the two measured engine openings on each hull. The atlas is 5,770 bytes.

## Space Dominators single-seat fighters in 44.52.0

The four vocabulary hulls each use one fixed 64-pixel image in the shared atlas. Scout, Guardian, Diver and Tracker keep their individual silhouettes throughout flight. The fleet intro reuses those same images. Boss 6 formations mix cannon, homing-missile and straight-laser fighters. Each type has its own static hull. The laser locks a visible firing line for 0.75 seconds. Destroying the fighter or withdrawing the formation cancels a pending shot.

Incoming vocabulary fighters and deck fighters can hit a pilot as soon as their hulls overlap. Contact uses both objects' motion across the simulation step. Undisclosed vocabulary can take hull damage without grading an answer. A lost required target gets a replacement. The next arrival clock starts when the newest vocabulary fleet displays its words, including waiting formations. The normal entry warning still uses the last three seconds of that clock. Host and wingmate use flight protocol 7 for the revised simulation.

## Space Dominators boss hulls in 44.53.0

Beacon Frigate, Rail Warden, Hound Carrier and Anchor Miner each use a 256 by 128 indexed transparent PNG with two registered 128-pixel cells. Combat and Boss Lab select the intact image above half health and the damaged image at or below half. The carrier's ten magazine doors line up with the existing missile origin coordinates. Boss 4 uses the same static hull selector as the first three while its cable, gate and mine equipment continue to draw separately. The four small hull sheets are part of the offline shell.

## Inspecting Dock in 44.54.0

The mini-boss after the sixth vocabulary fleet is an orbital inspection station. Its two destructible side magazines fire three missile pairs solo or six pairs with a wingmate. Pairs leave 0.14 seconds apart and a new salvo begins every 5.5 seconds. The missiles use the Hound Carrier's outward arc, one second of pursuit and straight final flight. Removing a magazine suppresses its half of every remaining salvo.

The central turret aims at one pilot for eight rounds from the first shot to the last in one second. It rests two seconds after the last shot and alternates the target between available pilots in co-op. Each side mount has 125% of the former mount's health and the central gun has 150%, rounded up. All three are independently destructible. Saved battery encounters retain the fraction of health on each mount. The host snapshot includes both firing schedules, target seats and the current salvo positions. Arcade Space uses co-op protocol 8.

## Hound Carrier missile counts in 44.55.0

Crescent Salvo fires six pairs. The final pair launches from the top magazine doors again. Brood Splitters fires two mother missiles solo and four simultaneously in co-op. The second pair uses the second bay from the top on each side. Each surviving mother releases six children after 0.95 seconds. Three child slots across the entire cast are selected for brief homing before the parents launch. Intercepting a mother removes its assigned six slots. The warning flashes use the same port coordinates as the missiles. Arcade Space flight protocol 9 keeps both peers on the same rules.

## Inspecting Dock durability in 44.56.0

All three mounts have three times their 44.55.0 HP at each weapon level in solo and co-op. At weapon level one each missile rack has 27 HP and the central gun has 33 HP. Old station checkpoints triple current and maximum HP exactly once, including zero HP on destroyed mounts. Loading a current checkpoint preserves each exact damage value and the current salvo timers. Arcade Space flight protocol 10 identifies this simulation.

## Aegis titanium hull in 44.57.0

The third player-hull cell contains the dark titanium Aegis, with stepped shoulder armor and a short cyan cockpit slit. The two nozzle centers remain at (94, 226) and (158, 226) in the 256-pixel cell. The hangar and flight renderer sample the same static hull beneath the existing exhaust animation.

## Space Dominators flight standings in 44.58.0

The hangar switches between Solo and Team records. Count enemy spacecraft destroyed by pilots, their fleet clears and collisions. Ignore fleet overflow, projectiles, asteroids and turret mounts. Boss Lab and Boss Rush are practice. Campaign results belong to the launch profile. For a co-op mission only the host records the full team totals. The wingmate keeps the existing credit settlement and sees the debrief.

Firestore uses separate spaceFlightSolo and spaceFlightTeam collections in the suite project. Each pilot document holds one best mission and its missions subcollection records completed flights by unique ID. Atomic conditional writes deduplicate retries and protect the best score across devices. Queued uploads persist across reloads. The board reads six entries, the pilot's own record, and a count of higher scores only when that pilot is outside the first six. Equal scores share rank. Cached boards last five minutes. No vocabulary or chess data is written.

## LexicalSpace multilingual libraries in 44.60.0

Keep the English IndexedDB and Firebase paths. French continues to use LexicalSpaceFrenchDB, and Mandarin uses LexicalSpaceChineseDB. Their Firebase words and stats are isolated in words_fr / words_zh and vocabulary_stats_fr / vocabulary_stats_zh. Existing French records enter the durable outbox once per profile and device without incrementing their versions. Normal conflict resolution and retries apply. Guest libraries and session history stay local.

The new zh-Hans interface and Mandarin study toggles are independent. Mandarin uses pinyin in the existing phonetic field, uses Mandarin speech where available, and lets the IME finalize characters before form submission. Shared deck codes and English dictionary lookups still use the existing English workflows.
