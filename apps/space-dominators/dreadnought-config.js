(() => {
  'use strict';
  window.SpaceDreadnoughtConfig=Object.freeze({
    introSeconds:28.5, objective:100, coopObjective:150,
    scrollSpeed:38, baseProjectileSpeed:230,
    maxTurrets:6,maxFighters:30,maxProjectiles:100,maxMissiles:14,maxBeams:2,
    warningSeconds:3, spawnInterval:4.8,
    formationDuration:15,formationKillLimit:10,formationEntrySeconds:2.4,formationExitSeconds:2.4,formationGap:.5,
    spritePivots:Object.freeze({head_fan_wave:[64,88],head_expanding_orb:[64,78],head_twin_crossfire:[64,94],head_homing_missile:[64,91],head_shotgun_missile:[64,86],head_charging_laser:[64,108]}),
    fighterHP:6,fighterCooldown:3.4,fighterShotChance:.13,
    types:Object.freeze({
      fan:{head:'head_fan_wave',projectile:'proj_standard_fan',hp:10,unlockTime:0,cooldown:3.8,chargeTime:.4,fireDuration:.15,spawnChance:.8,speed:1,count:7},
      orb:{head:'head_expanding_orb',projectile:'proj_expanding_orb',hp:12,unlockTime:12,cooldown:5.4,chargeTime:.5,fireDuration:.15,spawnChance:.65,speed:.82,count:1},
      twin:{head:'head_twin_crossfire',projectile:'proj_twin_cross',hp:10,unlockTime:25,cooldown:3.6,chargeTime:.35,fireDuration:.25,spawnChance:.65,speed:1.12,count:2},
      homing:{head:'head_homing_missile',projectile:'proj_missile_homing',hp:12,unlockTime:36,cooldown:5.5,chargeTime:.6,fireDuration:.15,spawnChance:.65,speed:.85,count:2,priority:true},
      shotgun:{head:'head_shotgun_missile',projectile:'proj_missile_shotgun',hp:16,unlockTime:52,cooldown:6.8,chargeTime:.7,fireDuration:.2,spawnChance:.6,speed:.85,count:5,priority:true},
      sprinkler:{head:'turret_sprinkler',projectile:'proj_sprinkler_orb',hp:null,unlockTime:18,cooldown:.625,chargeTime:.075,fireDuration:.1,spawnChance:.6,speed:.7,count:4},
      laser:{head:'head_charging_laser',hp:18,unlockTime:75,cooldown:7,chargeTime:1.1,fireDuration:.45,spawnChance:.65,priority:true}
    }),
    waveRoutes:Object.freeze(['horizontal','diagonal','left','right'])
  });
})();
