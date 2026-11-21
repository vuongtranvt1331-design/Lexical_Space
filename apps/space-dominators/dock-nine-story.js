/* Dock Nine campaign radio. Each alias belongs to a single portrait tile. */
(() => {
  'use strict';
  const cast = {
    kite: ['Kite  /  Lan Võ', 0, 'friendly'], veyr: ['Admiral Oren Veyr', 1, 'hostile'],
    malrec: ['High Admiral Malrec', 2, 'hostile'], mechanic: ['Dock Nine mechanic', 3, 'friendly'],
    watch: ['Watch officer', 4, 'hostile'], skipper: ['Freighter captain', 5, 'friendly'],
    signal: ['Harbor signalman', 6, 'friendly'], miner: ['Mine tender', 7, 'friendly'],
    trader: ['Outpost shopkeeper', 8, 'neutral'], unknown: ['Unidentified voice', 9, 'hostile'],
    escort: ['Escort One', 4, 'hostile']
  };
  const nameColors={friendly:'#72baff',hostile:'#ff787a',neutral:'#e4d7b9'};
  function nameColor(actor){return nameColors[cast[actor][2]];}
  const scenes = {
    patrol: [
      ['kite', 'Same three destroyers. They held this gate when my father flew freight.'],
      ['watch', 'Patrol wings, deploy. Hold every civilian ship for inspection.']
    ],
    opening: [
      ['mechanic', 'Mayday from Dock Nine. A blast took out our power cores. All six air pumps just stopped.'],
      ['mechanic', 'Five thousand people live here. This beacon is on a battery. If anyone hears me, please answer.'],
      ['kite', 'I hear you. Freight hauler Kite, one gate out. I’ve got twelve fleet-yard cores. Will they fit?'],
      ['mechanic', 'Same fittings. We can have the first pump running before you finish unloading.'],
      ['kite', 'Gate Control, you heard her. Requesting clearance to divert to Dock Nine.'],
      ['watch', 'I heard her. I sent the request upstairs twice. Both times it came back stamped “fleet yard.”'],
      ['kite', 'Then put me down as the one who broke the seal. Can you give me a lane?'],
      ['watch', 'Kite, those patrol pilots can hear us too. If you cross that line, they have to follow you.'],
      ['kite', 'Understood. Dock Nine, clear a berth. I’m coming through.']
    ],
    boss1: [
      ['watch', 'Beacon Frigate is down, sir. One civilian hauler got through with twelve of our cores.'],
      ['veyr', 'Any word from the bridge crew?'],
      ['watch', 'Three pods answering. The captain’s is quiet. Fleet Command wants a preliminary report.'],
      ['veyr', 'Send the cutter back for the captain. Tell Rail Warden to close the inner gate.'],
      ['watch', 'Do you want me to wake the High Admiral?'],
      ['veyr', 'For one hauler? Put my name on the report. Let him sleep.']
    ],
    boss2: [
      ['skipper', 'Kite, I recorded the mayday and Control turning you down. The whole dock is listening now.'],
      ['kite', 'Bring your tug through while the gate is clear. I’ll need your crane for the cores.'],
      ['signal', 'The tug is through. Two more skippers have dropped their towlines to follow her.'],
      ['watch', 'Rail Warden has gone silent, Admiral. Hound Carrier wants permission to fire. There are civilian tugs in his sights.'],
      ['veyr', 'Give him the hauler’s transponder. He fires on that signal alone. Read the order back.'],
      ['watch', 'Fire on the hauler alone. I’ve entered the restriction in the gunnery log, sir.'],
      ['veyr', 'Good. Sign my name under it and launch the sector fleet.'],
      ['trader', 'Kite, berth three is free if you need repairs. Same price I charge the Navy.']
    ],
    boss3: [
      ['signal', 'Kite, I can take your return off the scope for eight seconds. Turn when I say.'],
      ['kite', 'Whoever reads the shift log will know it was you.'],
      ['signal', 'My sister’s on that tug. Five seconds. Turn now.'],
      ['watch', 'Sir, my scope just lost the hauler. One of our own relay stations is still answering him.'],
      ['veyr', 'Which operator?'],
      ['watch', 'I can give you the station number. I won’t guess at a name.'],
      ['veyr', 'Station number, then. Once a name goes in that report, I can’t take it out.']
    ],
    boss4: [
      ['miner', 'Mine seventeen is still hot, Kite. Stay left of the white seam and flash your lights for the tug.'],
      ['veyr', 'I know that voice. You used to take my cadets through here.'],
      ['miner', 'One of them called me from Dock Nine this morning. His little girl was breathing into a mask. Eighteen is clear, Kite.'],
      ['watch', 'We can silence that mine tender, sir. The gun crew is waiting.'],
      ['veyr', 'That tender has the only chart of the live mines. Do you want to take us through when he’s gone?'],
      ['watch', 'Guns holding. He’s leaving his survey lights on for our boats too.']
    ],
    intercept: [
      ['watch', 'A private call for you, Admiral. The belt is scattering the picture. I still have his voice.'],
      ['unknown', 'Fourteen ports opened their gates tonight. At the fifteenth they played your order back to my inspector.'],
      ['veyr', 'I authorized fire on the hauler. My flagship holds the far side of the belt.'],
      ['unknown', 'Yes, I read your restriction. Your gunners seem very clear about whom they may spare.'],
      ['veyr', 'They’re Imperial pilots, sir. I gave them an order they could carry out.'],
      ['unknown', 'Then stay at your post and see that they do. If I have to come there, you’ll give me your report in person.']
    ],
    boss5: [
      ['miner', 'You’re clear of the belt, Kite. Follow my survey lights. Dock Nine is just beyond the last gate.'],
      ['skipper', 'I’ve got the station in sight. Veyr has parked his flagship across the approach.'],
      ['watch', 'Admiral, the civilian ships are broadcasting their names. They want us to know who’s aboard.'],
      ['veyr', 'I can hear them. Tell the deck crews to put their suits on and leave the pod hatches open.'],
      ['watch', 'Yours too, sir?'],
      ['veyr', 'Mine too. Then sound battle stations.'],
      ['kite', 'Tug, stay on my stern. When there’s room to pass, take us straight to the loading arm.']
    ],
    boss6: [
      ['escort', 'Escort One to flagship. The hauler is through. I still have his jump trail. Permission to pursue?'],
      ['veyr', 'Break pursuit. Put your lights on the escape pods. Pick up our people first.'],
      ['escort', 'Sir, if I turn back now, we lose the trail.'],
      ['veyr', 'I know. Look at the viewport on that dark pod. Someone’s wiping the frost off it. Go get him.'],
      ['skipper', 'Dock Nine, that’s the last core in its cradle. Try the pumps.'],
      ['mechanic', 'Hear that rattle, Kite? Twelve years I’ve been trying to fix that fan. I could listen to it all night.'],
      ['kite', 'So could I. Tell the people cheering by your radio I can hear them all the way up here.'],
      ['signal', 'Another relief ship just got clearance at the next port. The gate crew opened it themselves.'],
      ['escort', 'Pod recovered. He’s alive. Sir, Fleet Command is asking why the pursuit ended. What do I tell High Admiral Malrec?'],
      ['veyr', 'Keep the boats out there. I’ve been trying to work out how to tell Malrec I let him go. Give me the set.']
    ],
    reveal: [
      ['malrec', 'A fine escort you gave that freighter, Admiral. I heard the welcome on the civilian band.'],
      ['veyr', 'I broke off pursuit. My last cutter was full. There was still a live pod against the hull. The escort brought him back.'],
      ['malrec', 'And while you counted heads, fourteen ports learned they could disobey me. You have failed the Empire, Veyr.'],
      ['veyr', 'It was my order. The watch officer read it back exactly as I gave it.'],
      ['malrec', 'Your watch officer keeps his post. Surrender your codes. You’ll stand trial on my flagship, before your own captains.'],
      ['veyr', 'Codes transferred. When the boats come in, please have someone send me the names.'],
      ['malrec', 'Kite, are you still on this frequency? Look out your viewport. I’ve come for you myself.']
    ],
    training: [
      ['kite', 'Target clear. Flight recorder marked the last pass. I’ll take a look at it back in the hangar.']
    ]
  };
  const tiles = new Image();
  tiles.src = new URL('assets/dock-nine-radio.png', document.currentScript.src).href;
  function portrait(ctx, actor, x, y, size) {
    if (!tiles.naturalWidth) return;
    const tile = cast[actor][1];
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiles, (tile % 5) * 48, Math.floor(tile / 5) * 48, 48, 48, x, y, size, size);
    ctx.restore();
  }
  function sceneFor(world) {
    if (world.phase === 'briefing') return 'opening';
    if (world.scene && Object.hasOwn(scenes, world.scene)) return world.scene;
    return world.bossIndex >= 1 && world.bossIndex <= 6 ? 'boss' + world.bossIndex : 'training';
  }
  const settingKey = 'space_dominators_dialogue_v1';
  let enabled = true;
  try { enabled = localStorage.getItem(settingKey) !== 'off'; } catch {}
  function setEnabled(value) {
    enabled = value;
    try { localStorage.setItem(settingKey, value ? 'on' : 'off'); } catch {}
  }
  window.addEventListener('storage', event => {
    if (event.key === settingKey || event.key === null) enabled = event.newValue !== 'off';
  });
  window.SpaceStory = Object.freeze({cast, scenes, sceneFor, portrait, nameColor,
    get enabled() { return enabled; }, setEnabled});
})();
