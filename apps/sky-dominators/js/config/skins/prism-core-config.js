/* Fixed 40-frame sprite geometry; all durations are milliseconds. */
(function(root,factory){const config=factory();if(typeof module==='object'&&module.exports)module.exports=config;else root.SkyPrismCoreConfig=config;})(globalThis,function(){return {
  "id": "prism_core",
  "name": "Flame / Prism Core",
  "aircraft": "chronos",
  "aircraftIndex": 8,
  "price": null,
  "rarity": null,
  "fps": 4,
  "frameMs": 250,
  "frameCount": 40,
  "durationMs": 10000,
  "loop": true,
  "atlas": "assets/skins/prism_core/flight-40.png",
  "atlasSize": [
    3328,
    2080
  ],
  "columns": 8,
  "rows": 5,
  "frameSize": [
    416,
    416
  ],
  "origin": [
    208,
    208
  ],
  "vfxScale": 1.7,
  "underFlareStyle": "black_fire",
  "hullStyle": "dark_gothic",
  "hullHeight": 176,
  "preview": "assets/skins/prism_core/preview.png",
  "states": {
    "idle": {
      "start": 0,
      "end": 39
    },
    "movement": {
      "start": 0,
      "end": 39
    }
  },
  "transition": {
    "preservePhase": true,
    "interpolation": "none",
    "note": "Blended VFX baked into adjacent frames; runtime holds each frame for 250 ms."
  },
  "frames": [
    {
      "index": 0,
      "file": "assets/skins/prism_core/frames/frame_01.png",
      "rect": [
        0,
        0,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 1,
      "file": "assets/skins/prism_core/frames/frame_02.png",
      "rect": [
        416,
        0,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 2,
      "file": "assets/skins/prism_core/frames/frame_03.png",
      "rect": [
        832,
        0,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 3,
      "file": "assets/skins/prism_core/frames/frame_04.png",
      "rect": [
        1248,
        0,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 4,
      "file": "assets/skins/prism_core/frames/frame_05.png",
      "rect": [
        1664,
        0,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 5,
      "file": "assets/skins/prism_core/frames/frame_06.png",
      "rect": [
        2080,
        0,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 6,
      "file": "assets/skins/prism_core/frames/frame_07.png",
      "rect": [
        2496,
        0,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 7,
      "file": "assets/skins/prism_core/frames/frame_08.png",
      "rect": [
        2912,
        0,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 8,
      "file": "assets/skins/prism_core/frames/frame_09.png",
      "rect": [
        0,
        416,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 9,
      "file": "assets/skins/prism_core/frames/frame_10.png",
      "rect": [
        416,
        416,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 10,
      "file": "assets/skins/prism_core/frames/frame_11.png",
      "rect": [
        832,
        416,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 11,
      "file": "assets/skins/prism_core/frames/frame_12.png",
      "rect": [
        1248,
        416,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 12,
      "file": "assets/skins/prism_core/frames/frame_13.png",
      "rect": [
        1664,
        416,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 13,
      "file": "assets/skins/prism_core/frames/frame_14.png",
      "rect": [
        2080,
        416,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 14,
      "file": "assets/skins/prism_core/frames/frame_15.png",
      "rect": [
        2496,
        416,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 15,
      "file": "assets/skins/prism_core/frames/frame_16.png",
      "rect": [
        2912,
        416,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 16,
      "file": "assets/skins/prism_core/frames/frame_17.png",
      "rect": [
        0,
        832,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 17,
      "file": "assets/skins/prism_core/frames/frame_18.png",
      "rect": [
        416,
        832,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 18,
      "file": "assets/skins/prism_core/frames/frame_19.png",
      "rect": [
        832,
        832,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 19,
      "file": "assets/skins/prism_core/frames/frame_20.png",
      "rect": [
        1248,
        832,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 20,
      "file": "assets/skins/prism_core/frames/frame_21.png",
      "rect": [
        1664,
        832,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 21,
      "file": "assets/skins/prism_core/frames/frame_22.png",
      "rect": [
        2080,
        832,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 22,
      "file": "assets/skins/prism_core/frames/frame_23.png",
      "rect": [
        2496,
        832,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 23,
      "file": "assets/skins/prism_core/frames/frame_24.png",
      "rect": [
        2912,
        832,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 24,
      "file": "assets/skins/prism_core/frames/frame_25.png",
      "rect": [
        0,
        1248,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 25,
      "file": "assets/skins/prism_core/frames/frame_26.png",
      "rect": [
        416,
        1248,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 26,
      "file": "assets/skins/prism_core/frames/frame_27.png",
      "rect": [
        832,
        1248,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 27,
      "file": "assets/skins/prism_core/frames/frame_28.png",
      "rect": [
        1248,
        1248,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 28,
      "file": "assets/skins/prism_core/frames/frame_29.png",
      "rect": [
        1664,
        1248,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 29,
      "file": "assets/skins/prism_core/frames/frame_30.png",
      "rect": [
        2080,
        1248,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 30,
      "file": "assets/skins/prism_core/frames/frame_31.png",
      "rect": [
        2496,
        1248,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 31,
      "file": "assets/skins/prism_core/frames/frame_32.png",
      "rect": [
        2912,
        1248,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 32,
      "file": "assets/skins/prism_core/frames/frame_33.png",
      "rect": [
        0,
        1664,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 33,
      "file": "assets/skins/prism_core/frames/frame_34.png",
      "rect": [
        416,
        1664,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 34,
      "file": "assets/skins/prism_core/frames/frame_35.png",
      "rect": [
        832,
        1664,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 35,
      "file": "assets/skins/prism_core/frames/frame_36.png",
      "rect": [
        1248,
        1664,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 36,
      "file": "assets/skins/prism_core/frames/frame_37.png",
      "rect": [
        1664,
        1664,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 37,
      "file": "assets/skins/prism_core/frames/frame_38.png",
      "rect": [
        2080,
        1664,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 38,
      "file": "assets/skins/prism_core/frames/frame_39.png",
      "rect": [
        2496,
        1664,
        416,
        416
      ],
      "durationMs": 250
    },
    {
      "index": 39,
      "file": "assets/skins/prism_core/frames/frame_40.png",
      "rect": [
        2912,
        1664,
        416,
        416
      ],
      "durationMs": 250
    }
  ]
};});
