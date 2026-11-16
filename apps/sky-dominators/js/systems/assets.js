/* js/systems/assets.js — ordered classic script; entrypoints declare dependency order. */
const assets = {
    bg: null,
    player: null,
    new_model: null,
    aircraft: [],
    flames: [],
    enemyHelicopters: [],
    enemyAircraft: [],
    rotorBlade: null,
    rotor1: null,
    rotor2: null,
    panelDanger: null,
    clouds: [],
    explosions: [],
    explosionsBig: []
};

function loadImage(src, altSrcList = []) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            if (altSrcList.length > 0) {
                const nextSrc = altSrcList.shift();
                loadImage(nextSrc, altSrcList).then(resolve);
            } else {
                resolve(null);
            }
        };
        img.src = src;
    });
}

async function initGameAssets() {
    const prefix1 = "assets/";
    const prefix2 = "assets_airstrike/";

    // Load the newly attached combined seamless background (Ocean Fleet -> Island Map)
    assets.bg = await loadImage(prefix1 + "bg_combined_seamless.png", [
        prefix2 + "bg_combined_seamless.png",
        prefix1 + "bg_new.png",
        prefix2 + "bg_new.png",
        prefix1 + "bg_island.png",
        prefix2 + "bg_island.png",
        prefix1 + "bg_canyon_seamless.png",
        prefix2 + "bg_canyon_seamless.png",
        prefix1 + "bg_canyon.jpg",
        prefix2 + "bg_canyon.jpg"
    ]);

    // Load 5 Player Aircraft Models and Matching Exhaust Flame Sprites from new_model pack
    assets.aircraft = [];
    assets.flames = [];

    // Primary player model: new_model (player_default.png)
    const p1 = await loadImage("assets/models/player_default.png", [
        "assets/new_model/player_default.png",
        "assets/models/new_model.png",
        "assets/new_model.png",
        "assets/player_default.png",
        prefix1 + "aircraft_1.png",
        prefix2 + "aircraft_1.png"
    ]);
    // Model 2: Titan (skin_1.png)
    const p2 = await loadImage("assets/models/skin_1.png", [
        "assets/new_model/skin_1.png",
        prefix1 + "aircraft_2.png",
        prefix2 + "aircraft_2.png"
    ]);
    // Model 3: Phantom (skin_2.png)
    const p3 = await loadImage("assets/models/skin_2.png", [
        "assets/new_model/skin_2.png",
        prefix1 + "aircraft_3.png",
        prefix2 + "aircraft_3.png"
    ]);
    // Model 4: Corsair / player_4 (skin_4.png - upper-body thrust source)
    const p4 = await loadImage("assets/models/skin_4.png?v=crosshair-1", [
        "assets/new_model/skin_4.png?v=crosshair-1",
        prefix1 + "aircraft_4.png?v=crosshair-1",
        prefix2 + "aircraft_4.png"
    ]);
    // Model 5: Delta (skin_3.png)
    const p5 = await loadImage("assets/models/skin_3.png", [
        "assets/new_model/skin_3.png",
        prefix1 + "aircraft_5.png",
        prefix2 + "aircraft_5.png"
    ]);

    assets.aircraft = [p1, p2, p3, p4, p5];
    for (const cfg of AIRCRAFT_CONFIGS.slice(5)) {
        assets.aircraft.push(await loadImage(cfg.file, ['assets/' + cfg.file]));
    }
    assets.new_model = p1;
    assets.player = p1;

    // Load thrust flame assets for all 5 models
    const flameOrder = [1, 2, 3, 5, 4];
    for (let i = 0; i < 5; i++) {
        const fn = flameOrder[i];
        const fSmall = await loadImage(prefix1 + `flame_${fn}_small.png`, [prefix2 + `flame_${fn}_small.png`]);
        const fLarge = await loadImage(prefix1 + `flame_${fn}_large.png`, [prefix2 + `flame_${fn}_large.png`]);
        assets.flames.push({ small: fSmall, large: fLarge });
    }

    // Load 3 Distinct Enemy Helicopter Variants (Intact and Damaged)
    assets.enemyHelicopters = [];
    assets.enemyAircraft = [];
    for (let i = 1; i <= 3; i++) {
        const intact = await loadImage(`assets/models/enemy_${i}.png`, [
            `assets/new_model/enemy_${i}.png`,
            `assets_airstrike/assets/models/enemy_${i}.png`,
            prefix1 + `enemy_${i}.png`,
            prefix2 + `enemy_${i}.png`,
            prefix1 + `enemy_aircraft_${i}.png`
        ]);
        const damaged = await loadImage(`assets/models/enemy_${i}_damaged.png`, [
            `assets/new_model/enemy_${i}_damaged.png`,
            `assets_airstrike/assets/models/enemy_${i}_damaged.png`,
            prefix1 + `enemy_${i}_damaged.png`,
            prefix2 + `enemy_${i}_damaged.png`,
            prefix1 + `enemy_aircraft_${i}_damaged.png`
        ]);
        const pair = { intact, damaged };
        assets.enemyHelicopters.push(pair);
        assets.enemyAircraft.push(pair);
    }

    // Load Helicopter Rotor Blade Sprite
    assets.rotorBlade = await loadImage("assets/models/rotor_blade.png", [
        "assets/new_model/rotor_blade.png",
        "assets_airstrike/assets/models/rotor_blade.png",
        prefix1 + "rotor_blade.png",
        prefix2 + "rotor_blade.png",
        prefix1 + "rotor_frame1.png"
    ]);
    assets.rotor1 = assets.rotorBlade;
    assets.rotor2 = assets.rotorBlade;
    assets.helicopterIntact = assets.enemyHelicopters[0] ? assets.enemyHelicopters[0].intact : null;
    assets.helicopterDamaged = assets.enemyHelicopters[0] ? assets.enemyHelicopters[0].damaged : null;
    assets.panelDanger = await loadImage(prefix1 + "panel_danger.png", [prefix2 + "panel_danger.png"]);

    // Load attached cloud sprites
    const cloudNames = [
        "cloud_1_small.png", "cloud_2_small_fluffy.png",
        "cloud_3_medium_flat.png", "cloud_4_medium_puff.png",
        "cloud_5_large_dense.png", "cloud_6_large_layered.png"
    ];
    assets.clouds = [];
    for (const cname of cloudNames) {
        const cImg = await loadImage(prefix1 + cname, [prefix2 + cname]);
        if (cImg) assets.clouds.push(cImg);
    }

    // Load attached explosion animation frames (1 to 5)
    assets.explosions = [];
    assets.explosionsBig = [];
    for (let i = 1; i <= 5; i++) {
        const expBig = await loadImage(prefix1 + `explosion_frame_${i}.png`, [prefix2 + `explosion_frame_${i}.png`]);
        if (expBig) assets.explosionsBig.push(expBig);
        const expSmall = await loadImage(prefix1 + `explosion_small_${i}.png`, [prefix2 + `explosion_small_${i}.png`]);
        if (expSmall) assets.explosions.push(expSmall);
    }
    if (assets.explosions.length === 0 && assets.explosionsBig.length > 0) {
        assets.explosions = assets.explosionsBig;
    }

    if (assets.bg) {
        terrain.setBgImage(assets.bg);
    }
}
