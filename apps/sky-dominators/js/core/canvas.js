/* js/core/canvas.js — ordered classic script; entrypoints declare dependency order. */
const canvas = document.getElementById('gameCanvas');

const ctx = canvas.getContext('2d');

let bossEncounter = null;

let attackSerial = 0;
