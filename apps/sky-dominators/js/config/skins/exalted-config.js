/* Exalted visual configuration; JSON mirror is checked by tests. */
(function(root,factory){const config=factory();if(typeof module==='object'&&module.exports)module.exports=config;else root.SkyExaltedConfig=config;})(globalThis,function(){return {
  "schemaVersion": 1,
  "id": "exalted",
  "name": "Exalted",
  "aircraft": [
    "fighter_1"
  ],
  "price": 3500,
  "rarity": null,
  "animation": {
    "fps": 4,
    "frameMs": 250,
    "style": "8-bit stepped",
    "referenceHeight": 88,
    "transitionFrames": 3,
    "pixelGrid": 1,
    "texturePixelsPerUnit": 1,
    "imageSmoothing": false
  },
  "runtimeAtlas": {
    "file": "assets/skins/exalted/runtime-atlas.png",
    "size": [
      512,
      164
    ],
    "regions": {
      "burstLeft": [
        1,
        1,
        36,
        38
      ],
      "burstRight": [
        39,
        1,
        36,
        38
      ],
      "frontLeft": [
        77,
        1,
        35,
        46
      ],
      "frontRight": [
        114,
        1,
        35,
        46
      ],
      "rearLeft": [
        151,
        1,
        28,
        42
      ],
      "rearRight": [
        181,
        1,
        28,
        42
      ],
      "tail": [
        211,
        1,
        17,
        22
      ],
      "body": [
        230,
        1,
        22,
        44
      ],
      "halo": [
        254,
        1,
        96,
        96
      ],
      "mark": [
        352,
        1,
        96,
        53
      ],
      "projectile": [
        450,
        1,
        8,
        32
      ],
      "elimination0": [
        1,
        99,
        64,
        64
      ],
      "elimination1": [
        67,
        99,
        64,
        64
      ],
      "elimination2": [
        133,
        99,
        64,
        64
      ],
      "elimination3": [
        199,
        99,
        64,
        64
      ]
    }
  },
  "assets": {
    "preview": {"file":"assets/skins/exalted/idle-preview.png","size":[160,160],"background":"transparent"},
    "parts": {
      "file": "assets/skins/exalted/aircraft-parts.png",
      "size": [
        1254,
        1254
      ],
      "background": "black",
      "threshold": 16
    },
    "halo": {
      "file": "assets/skins/exalted/halo.png",
      "size": [
        736,
        736
      ],
      "background": "white",
      "threshold": 24
    },
    "mark": {
      "file": "assets/skins/exalted/wing-sword-mark.png",
      "size": [
        714,
        480
      ],
      "background": "white",
      "threshold": 64,
      "tint": "#ffff00"
    },
    "burstWings": {
      "file": "assets/skins/exalted/burst-wing-pair.png",
      "size": [
        1774,
        887
      ],
      "background": "transparent",
      "alphaThreshold": 32
    },
    "projectile": {
      "file": "assets/skins/exalted/light-sword-projectile.png",
      "size": [
        1254,
        1254
      ],
      "background": "transparent"
    },
    "elimination": {
      "file": "assets/skins/exalted/angelic-elimination-sheet.png",
      "size": [
        1254,
        1254
      ],
      "background": "transparent"
    }
  },
  "parts": [
    {
      "id": "burstLeft",
      "asset": "burstWings",
      "visibleWhen": "skillActive",
      "rect": [
        40,
        47,
        750,
        800
      ],
      "seed": [
        600,
        300
      ],
      "size": [
        36,
        38.4
      ],
      "idle": [
        -20,
        0,
        0.87
      ],
      "folded": [
        -20,
        0,
        0.87
      ],
      "burst": [
        -43,
        0,
        0.87
      ]
    },
    {
      "id": "burstRight",
      "asset": "burstWings",
      "visibleWhen": "skillActive",
      "rect": [
        984,
        47,
        750,
        800
      ],
      "seed": [
        1150,
        300
      ],
      "size": [
        36,
        38.4
      ],
      "idle": [
        20,
        0,
        -0.87
      ],
      "folded": [
        20,
        0,
        -0.87
      ],
      "burst": [
        43,
        0,
        -0.87
      ]
    },
    {
      "id": "frontLeft",
      "rect": [
        13,
        75,
        464,
        615
      ],
      "seed": [
        350,
        200
      ],
      "size": [
        35,
        46.39
      ],
      "idle": [
        -30,
        -17,
        0
      ],
      "folded": [
        -23,
        -20,
        -0.55
      ],
      "burst": [
        -43,
        -36,
        1.8326
      ]
    },
    {
      "id": "frontRight",
      "rect": [
        775,
        75,
        465,
        616
      ],
      "seed": [
        900,
        200
      ],
      "size": [
        35,
        46.37
      ],
      "idle": [
        30,
        -17,
        0
      ],
      "folded": [
        23,
        -20,
        0.55
      ],
      "burst": [
        43,
        -36,
        -1.8326
      ]
    },
    {
      "id": "rearLeft",
      "rect": [
        40,
        555,
        432,
        641
      ],
      "seed": [
        370,
        660
      ],
      "size": [
        28,
        41.55
      ],
      "idle": [
        -32,
        25,
        0
      ],
      "folded": [
        -20,
        29,
        -0.55
      ],
      "burst": [
        -43,
        36,
        0.22
      ]
    },
    {
      "id": "rearRight",
      "rect": [
        782,
        554,
        429,
        642
      ],
      "seed": [
        875,
        660
      ],
      "size": [
        28,
        41.9
      ],
      "idle": [
        32,
        25,
        0
      ],
      "folded": [
        20,
        29,
        0.55
      ],
      "burst": [
        43,
        36,
        -0.22
      ]
    },
    {
      "id": "tail",
      "rect": [
        514,
        682,
        226,
        287
      ],
      "seed": [
        625,
        820
      ],
      "size": [
        17,
        21.59
      ],
      "idle": [
        0,
        29,
        0
      ],
      "folded": [
        0,
        29,
        0
      ],
      "burst": [
        0,
        32,
        0
      ]
    },
    {
      "id": "body",
      "rect": [
        480,
        110,
        294,
        582
      ],
      "seed": [
        627,
        350
      ],
      "size": [
        22,
        43.55
      ],
      "idle": [
        0,
        -10,
        0
      ],
      "folded": [
        0,
        -10,
        0
      ],
      "burst": [
        0,
        -10,
        0
      ]
    }
  ],
  "folding": {
    "forwardVelocityThreshold": -1,
    "minGap": 2,
    "preserveShape": true,
    "transform": "rigid translation and in-plane rotation only; unchanged width and height",
    "backwardVelocityThreshold": 1,
    "backwardFormation": "periodicSpread.poses; only while actual backward movement continues, below active skill priority"
  },
  "halo": {
    "opacity": 0.5,
    "layer": "above-body",
    "diameter": 78,
    "offset": [
      0,
      -12
    ],
    "rotationDegreesPerFrame": 7.5,
    "condition": "isShieldActive === true && shieldHp > 0",
    "immediateVisibility": true,
    "rotationRpm": 5,
    "revolutionMs": 12000,
    "skillScale": 1.6,
    "skillOpacity": 0.8,
    "expansionFrames": 3
  },
  "mark": {
    "tint": "#ffff00",
    "opacity": 1,
    "fit": "cover-visible-bounds-preserve-aspect",
    "pulseScales": [
      1,
      1.04,
      1.08,
      1.04
    ],
    "lifetime": "current-skill-only",
    "maxTargets": 32
  },
  "lifecycle": {
    "priority": [
      "burst",
      "spread",
      "forward",
      "idle"
    ],
    "clock": "game-update-delta-ms",
    "ownTimers": false,
    "ownAnimationLoop": false,
    "skillDuration": "existing player.skillActiveTimer",
    "cleanup": [
      "skill-expired",
      "target-destroyed",
      "skin-changed",
      "game-ended",
      "player-destroyed"
    ]
  },
  "notes": [
    "Original supplied RGB files are preserved byte-for-byte. Matte removal, six component extraction and nearest-neighbor pixel sampling happen once in the canvas renderer.",
    "Price is 3500 Coins for Player 1 only. Rarity remains unconfigured. Existing ownership/purchase rules apply; no automatic unlock.",
    "Cosmetic only. No damage, hitbox, shield recharge, cooldown or persistent data changes.",
    "The third wing pair is newly generated to match the supplied artwork; its original RGBA sheet is preserved. Only this pair is hidden immediately outside the existing active skill."
  ],
  "vibration": {
    "maxOffsetPixels": 2,
    "minOffsetPixels": 1,
    "frameMs": 250,
    "parts": [
      "frontLeft",
      "frontRight",
      "rearLeft",
      "rearRight",
      "burstLeft",
      "burstRight"
    ],
    "algorithm": "independent deterministic pseudorandom offsets from each formation anchor; no random walk; no gameplay RNG",
    "directions": [
      [
        1,
        0
      ],
      [
        -1,
        0
      ],
      [
        0,
        1
      ],
      [
        0,
        -1
      ],
      [
        2,
        0
      ],
      [
        -2,
        0
      ],
      [
        0,
        2
      ],
      [
        0,
        -2
      ],
      [
        1,
        1
      ],
      [
        1,
        -1
      ],
      [
        -1,
        1
      ],
      [
        -1,
        -1
      ]
    ]
  },
  "projectile": {
    "asset": "projectile",
    "displayBox": [
      12,
      32
    ],
    "pixelHeight": 32,
    "orientation": "source points up; rotate with projectile velocity",
    "physics": "unchanged existing Bullet"
  },
  "elimination": {
    "asset": "elimination",
    "columns": 2,
    "rows": 2,
    "frameSize": [
      627,
      627
    ],
    "count": 4,
    "frameMs": 250,
    "durationMs": 1000,
    "pixelSize": 64,
    "size": 76,
    "bigSize": 104,
    "loop": false,
    "trigger": "validated enemy destruction, attributed to killing projectile skin",
    "pool": "existing SkySkins effects pool"
  },
  "periodicSpread": {
    "intervalMs": 15000,
    "durationMs": 5000,
    "firstStartMs": 15000,
    "parts": [
      "frontLeft",
      "frontRight",
      "rearLeft",
      "rearRight"
    ],
    "clock": "existing unpaused animation clock",
    "priority": "below active skill; above ordinary idle/forward formation",
    "transitionFrames": 3,
    "poses": {
      "frontLeft": [
        -34,
        -17,
        0.65
      ],
      "frontRight": [
        34,
        -17,
        -0.65
      ],
      "rearLeft": [
        -33,
        25,
        0.8
      ],
      "rearRight": [
        33,
        25,
        -0.8
      ]
    }
  }
};});
