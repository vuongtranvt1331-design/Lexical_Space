(function(root,factory){const config=factory();if(typeof module==='object'&&module.exports)module.exports=config;else root.SkyOrnithopterConfig=config;})(globalThis,function(){
    'use strict';
    return Object.freeze({
        id:'ornithopter', aircraft:'corsair', price:2000,
        body:{file:'assets/skins/ornithopter/fuselage.png',rect:[282,85,460,1291]},
        wing:{file:'assets/skins/ornithopter/wing.png',rect:[153,236,1678,324],pivot:[.955,.42]},
        blurWing:{file:'assets/skins/ornithopter/wing_flap_blur.png',rect:[156,46,1648,690],pivot:[.9561613942,.4810229678]},
        hinges:{frontY:.322,rearY:.62,leftX:.13,rightX:.87},
        bodyHeightRatio:1.3, spanRatio:.95, rearSpanRatio:.80,
        animationFps:8, tipTravelPx:2.5, springFrequency:18,
        foldSweep:1.43, frontSweep:-.18, rearSweep:.24,
        enterForwardSpeed:12, leaveForwardSpeed:6, deceleration:90,
        meshSegments:8
    });
});
