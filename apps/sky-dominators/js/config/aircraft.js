/* js/config/aircraft.js — ordered classic script; entrypoints declare dependency order. */
const AIRCRAFT_CONFIGS = [
    {
        id: 1,
        key: "fighter_1",
        name: "Player 1",
        title: "Target Lock",
        modelName: "new_model",
        file: "assets/models/player_default.png",
        engineType: "Twin-Engine",
        width: 46,
        height: 68,
        rotation: 0,
        maxHp: 3,
        maxArmor: 0,
        damagePerShot: 1,
        shotsToDestroy: 2,
        descriptions: [
            "3 HP hull capacity with balanced agility",
            "Target Lock skill highlights priority target (8s)",
            "Precision manual firing; requires 2 shots per enemy"
        ],
        skillName: "Target Lock",
        skillIcon: "🎯",
        skillCooldown: 35000, // 35s
        skillDuration: 8000,   // 8s active target indicator
        hasActiveSkill: true,
        exhausts: [
            { xRatio: -0.116, yRatio: 0.465 },
            { xRatio:  0.116, yRatio: 0.465 }
        ],
        flameWidth: 10,
        flameHeight: 24
    },
    {
        id: 2,
        key: "titan",
        name: "Titan",
        title: "Heavy Armor Advantage",
        modelName: "skin_1",
        file: "assets/models/skin_1.png",
        engineType: "Tri-Engine",
        width: 54,
        height: 65,
        rotation: 0,
        maxHp: 3, // Three health units, separate from the two armor units
        maxArmor: 2, // Starts with 2x standard starting armor (2 units)
        armorRecoveryInterval: STANDARD_DEFENSE_RECOVERY_MS * TITAN_ARMOR_RECOVERY_MULTIPLIER,
        damagePerShot: 1,
        shotsToDestroy: 2, // Requires 2 shots to destroy a full-health regular enemy
        descriptions: [
            "3 HP hull with 2 independent armor units",
            "Independent armor recovery (28s per depleted unit)",
            "Heavy cannon requires 2 shots per enemy"
        ],
        skillName: "Heavy Armor Advantage",
        skillIcon: "🛡️",
        skillCooldown: 0,
        skillDuration: 0,
        hasActiveSkill: false,
        exhausts: [
            { xRatio: -0.199, yRatio: 0.452 },
            { xRatio:  0.000, yRatio: 0.482 },
            { xRatio:  0.199, yRatio: 0.452 }
        ],
        flameWidth: 8,
        flameHeight: 20
    },
    {
        id: 3,
        key: "phantom",
        name: "Phantom",
        title: "Electromagnetic Storm",
        modelName: "skin_2",
        file: "assets/models/skin_2.png",
        engineType: "Single-Engine",
        width: 46,
        height: 63,
        rotation: 0,
        maxHp: 3,
        maxArmor: 0,
        damagePerShot: 1,
        shotsToDestroy: 2,
        descriptions: [
            "3 HP agile single-engine stealth frame",
            "EMP Storm skill delays next wave by 7s",
            "Leaves active airborne enemies intact"
        ],
        skillName: "Electromagnetic Storm",
        skillIcon: "⚡",
        skillCooldown: 30000, // 30s
        skillDuration: 0,
        hasActiveSkill: true,
        exhausts: [
            { xRatio:  0.000, yRatio: 0.472 }
        ],
        flameWidth: 12,
        flameHeight: 26
    },
    {
        id: 4,
        key: "corsair",
        name: "CrossHair",
        title: "One-Shot Destroyer",
        modelName: "skin_4",
        file: "assets/models/skin_4.png?v=crosshair-1",
        engineType: "Main Rotor",
        width: 48,
        height: 64,
        rotation: 0,
        maxHp: 3, // Increased by exactly 1 HP (from 2 HP to 3 HP)
        maxArmor: 0,
        damagePerShot: 2,
        shotsToDestroy: 1, // One-shot destruction passive
        descriptions: [
            "3 HP combat helicopter platform",
            "One-Shot Destruction passive wipes entire row",
            "Wing Boost: 1.6x movement for 3s; 20s cooldown"
        ],
        skillName: "Wing Boost",
        skillIcon: "💥",
        skillCooldown: 20000,
        skillDuration: 3000,
        hasActiveSkill: true,
        boostMultiplier: 1.6,
        exhausts: [
            { xRatio: 0.182, yRatio: -0.108 },
            { xRatio: -0.182, yRatio: -0.108 }
        ],
        flameWidth: 10,
        flameHeight: 24
    },
    {
        id: 5,
        key: "phantom_prototype",
        name: "Phantom Prototype",
        title: "Phantom Squadron",
        modelName: "skin_3",
        file: "assets/models/skin_3.png",
        engineType: "Delta Single-Engine",
        width: 48,
        height: 66,
        rotation: 0,
        maxHp: 3, // Exactly 3 HP capacity
        maxArmor: 0, // Secondary yellow health/armor indicator removed
        armorRecoveryInterval: STANDARD_DEFENSE_RECOVERY_MS,
        damagePerShot: 1,
        shotsToDestroy: 2,
        descriptions: [
            "3 HP agile delta-wing tactical platform",
            "Phantom Squadron summons 4 wingmen (60s CD)",
            "Skill consumes shield, or 1 HP if recovering (requires 2+ HP)"
        ],
        skillName: "Phantom Squadron",
        skillIcon: "✈️",
        skillCooldown: 60000, // 60s
        skillDuration: 4000,  // 4s screen-clearing strike
        hasActiveSkill: true,
        exhausts: [
            { xRatio:  0.000, yRatio: 0.472 }
        ],
        flameWidth: 12,
        flameHeight: 26
    }
];

AIRCRAFT_CONFIGS.push(...[
    {
                "id": 6,
                "key": "viper",
                "name": "Viper",
                "title": "Swift Speed",
                "modelName": "viper",
                "file": "assets/models/viper.png",
                "engineType": "Advanced Fighter",
                "width": 70,
                "height": 68,
                "rotation": 0,


                "maxHp": 3,
                "maxArmor": 0,
                "damagePerShot": 1,
                "shotsToDestroy": 2,
                "descriptions": [
                            "Immune to enemy bullets and helicopter collisions",
                            "Collisions do not destroy enemies or award points",
                            "350 px/s mobility; wrong answers and breaches still hurt"
                ],
                "skillName": "Swift Speed",
                "skillIcon": "✦",
                "skillCooldown": 0,
                "skillDuration": 0,
                "hasActiveSkill": false,
                "speed": 350,
                "touchFollow": 0.24,
                "exhausts": [],
                "flameWidth": 10,
                "flameHeight": 24
    },
    {
                "id": 7,
                "key": "reaper",
                "name": "Reaper",
                "title": "Precision Striker",
                "modelName": "reaper",
                "file": "assets/models/reaper.png",
                "engineType": "Advanced Fighter",
                "width": 68,
                "height": 68,
                "rotation": 0,


                "maxHp": 3,
                "maxArmor": 0,
                "damagePerShot": 1,
                "shotsToDestroy": 2,
                "descriptions": [
                            "Guided shots steer toward nearby enemies ahead",
                            "Targets only living enemies in the first two rows",
                            "Standard projectile speed and two-hit damage"
                ],
                "skillName": "Precision Striker",
                "skillIcon": "✦",
                "skillCooldown": 0,
                "skillDuration": 0,
                "hasActiveSkill": false,
                "speed": 280,
                "touchFollow": 0.18,
                "exhausts": [],
                "flameWidth": 10,
                "flameHeight": 24
    },
    {
                "id": 8,
                "key": "nightbat",
                "name": "NightBat",
                "title": "Survivor",
                "modelName": "nightbat",
                "file": "assets/models/nightbat.png",
                "engineType": "Advanced Fighter",
                "width": 76,
                "height": 67,
                "rotation": 0,


                "maxHp": 5,
                "maxArmor": 0,
                "damagePerShot": 1,
                "shotsToDestroy": 2,
                "descriptions": [
                            "Restores 1 HP after every 7 completed enemy rows",
                            "Wrong answers and breach-cleared rows also count",
                            "5 HP maximum; no shield"
                ],
                "skillName": "Survivor",
                "skillIcon": "✦",
                "skillCooldown": 0,
                "skillDuration": 0,
                "hasActiveSkill": false,
                "speed": 280,
                "touchFollow": 0.18,
                "exhausts": [],
                "flameWidth": 10,
                "flameHeight": 24
    },
    {
                "id": 9,
                "key": "chronos",
                "name": "Chronos",
                "title": "Temporal Guardian",
                "modelName": "chronos",
                "file": "assets/models/chronos.png",
                "engineType": "Advanced Fighter",
                "width": 57,
                "height": 68,
                "rotation": 0,


                "maxHp": 1,
                "maxArmor": 0,
                "damagePerShot": 1,
                "shotsToDestroy": 2,
                "descriptions": [
                            "Survive lethal damage at 1 HP; bullet immunity for 5s (300s cooldown)",
                            "Every 12 completed rows adds one filled HP slot; existing missing HP stays missing",
                            "Press E or Q to heal 1 HP; 60-second cooldown"
                ],
                "skillName": "Temporal Restoration",
                "skillIcon": "⏳",
                "skillCooldown": 60000,
                "skillDuration": 0,
                "hasActiveSkill": true,
                "speed": 280,
                "touchFollow": 0.18,
                "exhausts": [],
                "flameWidth": 10,
                "flameHeight": 24
    }
]);

AIRCRAFT_CONFIGS.push({id:10,key:'bomber',name:'Bomber',title:'Row Strike',modelName:'bomber',file:SkySkinCatalog.bodies.bomber.factory_default,engineType:'Flying Wing',width:96,height:64,rotation:0,maxHp:3,maxArmor:0,damagePerShot:1,shotsToDestroy:2,speed:280,hasActiveSkill:true,skillName:'Row Strike',skillIcon:'✦',skillCooldown:30000,skillDuration:0,exhausts:[{xRatio:-.18,yRatio:.24},{xRatio:.18,yRatio:.24}],flameWidth:10,flameHeight:24,descriptions:['3 HP with one standard 40s shield','Row Strike clears one front row; 30s cooldown','Special missile deals 20 damage to bosses']});
