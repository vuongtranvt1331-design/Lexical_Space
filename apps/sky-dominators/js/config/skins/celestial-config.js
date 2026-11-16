/* Celestial: cosmetic sprite geometry and 3 FPS clock. */
(function(root,factory){const config=factory();if(typeof module==='object'&&module.exports)module.exports=config;else root.SkyCelestialConfig=config;})(globalThis,function(){return {
  "id": "celestial",
  "name": "Celestial",
  "aircraft": "fighter_1",
  "fps": 3,
  "frameMs": 333.3333333333333,
  "referenceHeight": 76,
  "transitionTicks": 3,
  "atlas": "assets/skins/celestial/runtime-atlas.png",
  "preview": "assets/skins/celestial/preview.png",
  "source": {
    "file": "assets/skins/celestial/source-atlas.png",
    "size": [
      1448,
      1086
    ]
  },
  "parts": [
    {
      "id": "upperLeft",
      "source": [
        305,
        35,
        409,
        330
      ],
      "box": [
        62,
        48
      ],
      "anchor": [
        0.94,
        0.72
      ],
      "position": [
        -9,
        -2
      ],
      "foldAngle": -1.92
    },
    {
      "id": "upperRight",
      "source": [
        738,
        40,
        410,
        325
      ],
      "box": [
        62,
        48
      ],
      "anchor": [
        0.06,
        0.72
      ],
      "position": [
        9,
        -2
      ],
      "foldAngle": 1.92
    },
    {
      "id": "lowerLeft",
      "source": [
        0,
        410,
        350,
        312
      ],
      "box": [
        43,
        42
      ],
      "anchor": [
        0.92,
        0.12
      ],
      "position": [
        -10,
        3
      ],
      "foldAngle": -0.74
    },
    {
      "id": "lowerRight",
      "source": [
        420,
        410,
        313,
        316
      ],
      "box": [
        43,
        42
      ],
      "anchor": [
        0.08,
        0.12
      ],
      "position": [
        10,
        3
      ],
      "foldAngle": 0.74
    },
    {
      "id": "body",
      "source": [
        90,
        0,
        180,
        410
      ],
      "box": [
        28,
        76
      ],
      "anchor": [
        0.5,
        0.5
      ],
      "position": [
        0,
        -3
      ],
      "foldAngle": 0
    }
  ],
  "projectile": {
    "sources": [
      [
        1160,
        0,
        210,
        366
      ],
      [
        810,
        380,
        205,
        342
      ],
      [
        1170,
        380,
        200,
        342
      ]
    ],
    "box": [
      12,
      32
    ],
    "count": 3
  },
  "explosion": {
    "sources": [
      [
        0,
        726,
        362,
        360
      ],
      [
        362,
        726,
        362,
        360
      ],
      [
        724,
        726,
        362,
        360
      ],
      [
        1086,
        726,
        362,
        360
      ]
    ],
    "box": [
      64,
      64
    ],
    "count": 4,
    "durationMs": 1333.3333333333333,
    "impactSize": 38,
    "deathSize": 86,
    "bigSize": 112
  },
  "regions": {
    "upperLeft": [
      1,
      1,
      62,
      45
    ],
    "upperRight": [
      65,
      1,
      62,
      45
    ],
    "lowerLeft": [
      129,
      1,
      43,
      38
    ],
    "lowerRight": [
      174,
      1,
      43,
      42
    ],
    "body": [
      219,
      1,
      26,
      76
    ],
    "projectile0": [
      247,
      1,
      10,
      32
    ],
    "projectile1": [
      259,
      1,
      10,
      32
    ],
    "projectile2": [
      271,
      1,
      10,
      32
    ],
    "explosion0": [
      283,
      1,
      64,
      64
    ],
    "explosion1": [
      349,
      1,
      64,
      64
    ],
    "explosion2": [
      415,
      1,
      64,
      64
    ],
    "explosion3": [
      1,
      79,
      64,
      64
    ]
  },
  "atlasSize": [
    512,
    256
  ]
};});
