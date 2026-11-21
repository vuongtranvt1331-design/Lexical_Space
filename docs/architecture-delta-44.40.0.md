# Boss Lab 11 fleet art and hyperspace audio

The lab uses four front-view hulls. A Venator enters last at x = 640. An Acclamator and an Imperial flank it, with more escorts and the original purple dreadnought further back. All nine use the same projection and apparent world width. Each transparent PNG is shared by the ships of its class. The thumbnail uses the Venator.

The provided recording matches the existing `apps/space-dominators/assets/audio/hyperspaceexit.mp3` byte-for-byte (SHA-256 `e2046a2d8989334039208f6137767269232f80fb7e9f76b58a6dbc1c255beaac`). Browser decoding yields 3.759 seconds of stereo audio. Analysis in 10 ms windows places the broadband impact onset at about 1.41 s, after the rising approach sound.

Each ship owns one cue derived from its jump time. The shared decoded buffer starts at the animation epoch + jump start + 0.20 s − 1.41 s. The first jump starts at 1.23 s, leaving room for its audio lead-in. The corresponding first and last impacts are at 1.43 s and 3.37 s. The output clock drives the visual timeline. Pan follows the horizontal position and gain follows depth. Stopping or leaving the preview cancels scheduled sounds. The master effects volume controls the mix.

In 44.41.0 the original purple dreadnought leads the formation. The three former dreadnought escorts use the Venator sprite. The central ship uses a 1.30 sprite scale throughout the shot. Its center at full reveal is (640, 384) on the 1280 × 720 canvas, 24 pixels higher than before. The thumbnail shows the flagship.

In 44.42.0 the near left and right escorts use the red Venator. The Acclamator and Imperial occupy the two former Venator positions immediately behind the flagship. After each jump the six rear ships gain apparent width and height at twice their previous rate. The original depth projection still anchors their centers and locates each audio cue.
