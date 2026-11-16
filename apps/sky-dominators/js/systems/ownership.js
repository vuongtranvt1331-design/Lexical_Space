/* js/systems/ownership.js — ordered classic script; entrypoints declare dependency order. */
function isAircraftUnlocked(index) { return SkyProfile.owns(index); }

window.isAircraftUnlocked=isAircraftUnlocked;
