// Two-player transport. The host owns lobby state; a per-tab ticket survives reload.
(() => {
  'use strict';
  const KEY = 'space_dominators_room_v1';
  const PREFIX = 'space-dominators-coop-v1-';
  const VERSION = 4;
  const ships = ['kestrel','spectre','aegis','tempest'];
  const pilotName = value => typeof value === 'string' ? value.trim().slice(0, 32) : '';
  const localName = pilotName(new URLSearchParams(location.search).get('user')) || 'Pilot';
  const soloMatches = new Set();
  const validCode = value => typeof value === 'string' && /^\d{4}$/.test(value);
  const validSecret = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
  function token() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
  }
  function randomCode() {
    return String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4,'0');
  }
  const bounded = (v,max) => Number.isInteger(v) && v >= 1 && v <= max;
  const validLab = lab => lab == null || (bounded(lab.boss,10) && bounded(lab.phase,lab.boss===10?3:2) && bounded(lab.level,8) && (lab.skillIndex == null || (Number.isInteger(lab.skillIndex) && lab.skillIndex >= 0 && lab.skillIndex < 2 + Math.floor((lab.boss-1)/2))));
  function validLobby(data) {
    return data && validLab(data.lab) && ['lobby','playing'].includes(data.phase) &&
      (data.phase === 'playing' ? validSecret(data.matchId) : data.matchId === '') &&
      Array.isArray(data.ready) && data.ready.length === 2 && data.ready.every(v => typeof v === 'boolean') &&
      Array.isArray(data.ships) && data.ships.length === 2 && data.ships.every(v => ships.includes(v));
  }
  function readTicket(storageName) {
    try {
      const saved = JSON.parse(window[storageName].getItem(KEY));
      if (validLobby(saved) && validCode(saved.code) && validSecret(saved.identity) &&
          ['host','guest'].includes(saved.role) && (!saved.partner || validSecret(saved.partner))) return saved;
    } catch {}
    return null;
  }
  let room = readTicket('sessionStorage');
  let peer = null, link = null, connected = false, retryTimer, handshakeTimer, heartbeat, lastSeen, retryAttempt = 0;
  let status = room ? 'reconnecting' : 'idle', error = '';
  function state() {
    return {code:room?.code || '',role:room?.role || null,phase:room?.phase || 'lobby',
      ready:room ? [...room.ready] : [false,false],ships:room ? [...room.ships] : [ships[0],ships[0]],
      names:[0,1].map(side => pilotName(room?.names?.[side])),
      lab:room?.lab || null,matchId:room?.matchId || '',connected,status,error};
  }
  function emit(name,detail) { window.dispatchEvent(new CustomEvent('spacecoop:'+name,{detail})); }
  function notify() { emit('state',state()); }
  function save() {
    try { if (room) sessionStorage.setItem(KEY,JSON.stringify(room)); else sessionStorage.removeItem(KEY); } catch {}
    if (room?.claimed) {
      try { localStorage.setItem(KEY,JSON.stringify(room)); } catch {}
    }
  }
  function forgetSaved() {
    if (room && readTicket('localStorage')?.identity === room.identity) {
      try { localStorage.removeItem(KEY); } catch {}
    }
  }
  function resumeSaved() {
    if (room) return false;
    const saved = readTicket('localStorage');
    if (!saved || (saved.matchId && soloMatches.has(saved.matchId))) return false;
    room = saved; status = 'reconnecting'; error = '';
    save(); notify(); connect(); return true;
  }
  function detach() {
    clearTimeout(handshakeTimer); clearInterval(heartbeat);
    const previous = link; link = null; connected = false;
    if (previous) { try { previous.close(); } catch {} }
  }
  function closePeer() {
    clearTimeout(retryTimer); detach();
    const previous = peer; peer = null;
    if (previous) { try { previous.destroy(); } catch {} }
  }
  function convertToSolo(reason = 'transport-lost') {
    if (!room || room.phase !== 'playing' || !room.matchId) return false;
    const matchId = room.matchId;
    if (soloMatches.has(matchId)) return false;
    soloMatches.add(matchId);
    const detail = {
      matchId,
      role: room.role,
      code: room.code,
      lab: room.lab ? { ...room.lab } : null,
      ship: room.ships[room.role === 'host' ? 0 : 1],
      reason
    };
    closePeer();
    forgetSaved();
    room = null;
    retryAttempt = 0;
    save();
    status = 'idle';
    error = '';
    notify();
    emit('solo', detail);
    return true;
  }
  function retry(message) {
    if (!room) return;
    clearTimeout(retryTimer);
    status = 'reconnecting'; error = message || ''; notify();
    const delay = window.SpaceSuitePeerTransport ? window.SpaceSuitePeerTransport.backoffDelay(retryAttempt++) : Math.min(10000, Math.round(1500 * Math.pow(1.5, Math.min(retryAttempt++, 6)) + Math.random() * 300));
    retryTimer = setTimeout(connect, delay);
  }
  function disconnect(message) {
    if (room?.phase === 'playing') {
      convertToSolo('transport-lost');
      return;
    }
    detach(); 
    if (room && room.role === 'host' && peer?.open) { status = 'reconnecting'; if (message) error = message; notify(); }
    else retry(message);
  }
  function transmit(kind, fields = {}) {
    if (!link?.open) return false;
    try { link.send({v:VERSION,kind,...fields}); return true; }
    catch { disconnect(); return false; }
  }
  function sync() {
    return transmit('state',{phase:room.phase,lab:room.lab || null,matchId:room.matchId,ships:room.ships.slice(),names:[localName,pilotName(room.names?.[1])],ready:room.ready.slice()});
  }
  function activate() {
    clearTimeout(handshakeTimer); clearTimeout(retryTimer);
    retryAttempt = 0;
    connected = true; status = 'connected'; error = ''; lastSeen = Date.now();
    clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      if (!link?.open || Date.now()-lastSeen > 22000) { disconnect(); return; }
      transmit('ping');
    },4000);
  }
  function commitReady(side,value,shipId) {
    room.ready[side] = value;
    if (ships.includes(shipId)) room.ships[side] = shipId;
    const start = room.ready.every(Boolean);
    if (start) { room.phase = 'playing'; room.matchId = token(); }
    save(); sync(); notify();
    if (start) emit('start',state());
  }
  function handle(data) {
    if (!room || !data || data.v !== VERSION) return;
    if (data.matchId && soloMatches.has(data.matchId)) return;
    lastSeen = Date.now();
    if (data.kind === 'reject' && !connected && room.role === 'guest') {
      const message = 'This room already has a teammate.';
      closePeer(); forgetSaved(); room = null; save(); status = 'error'; error = message; notify(); return;
    }
    if (data.kind === 'hello' && room.role === 'host' && !connected && validSecret(data.identity) && data.identity === link.metadata?.identity) {
      if (room.partner && room.partner !== data.identity) { transmit('reject'); disconnect(); return; }
      room.partner = data.identity;
      room.names = [localName,pilotName(data.name)];
      if (room.phase === 'lobby' && !room.ready[1] && ships.includes(data.ship)) room.ships[1] = data.ship;
      save(); activate(); sync(); notify(); return;
    }
    if (data.kind === 'state' && room.role === 'guest' && validLobby(data)) {
      if (soloMatches.has(data.matchId)) return;
      const start = data.phase === 'playing' && room.matchId !== data.matchId;
      Object.assign(room,{claimed:true,lab:data.lab || null,phase:data.phase,ready:data.ready.slice(),ships:data.ships.slice(),names:[pilotName(data.names?.[0]),localName],matchId:data.matchId});
      save(); if (!connected) activate(); notify(); if (start) emit('start',state()); return;
    }
    if (!connected) return;
    if (data.kind === 'ping') transmit('pong');
    if (data.kind === 'stop-mission' && room.role === 'host' &&
        room.phase === 'playing' && data.matchId === room.matchId) {
      resetMatch();
      return;
    }
    if (data.kind === 'leave') {
      if (room.phase === 'playing') {
        convertToSolo('partner-left');
        return;
      }
      leave(false);
      return;
    }
    if (data.kind === 'ready' && room.role === 'host' && room.phase === 'lobby' &&
        typeof data.value === 'boolean' && ships.includes(data.ship)) commitReady(1,data.value,data.ship);
    if (data.kind === 'event' && room.phase === 'playing' && room.matchId === data.matchId &&
        typeof data.type === 'string' && data.type.length <= 64) emit('message',{type:data.type,payload:data.payload});
  }
  function attach(conn) {
    link = conn;
    handshakeTimer = setTimeout(() => {
      if (link === conn && !connected) {
        disconnect('Connection timed out. Carrier NAT or firewall may be blocking direct P2P.');
      }
    }, 16000);
    conn.on('open',() => {
      if (link === conn && room.role === 'guest') transmit('hello',{identity:room.identity,name:localName,ship:room.ships[1]});
    });
    conn.on('data',data => { if (link === conn) handle(data); });
    const lost = () => { if (link === conn) disconnect(); };
    conn.on('close',lost); conn.on('error',lost);
  }
  let credentialsPrepared = false;
  function connect() {
    if (!room || connected) return;
    closePeer();
    if (typeof window.Peer !== 'function') {
      if (window.SpaceSuitePeerTransport) {
        window.SpaceSuitePeerTransport.ensurePeer().then(connect).catch(() => {
          status = 'error'; error = 'Room networking could not load.'; notify();
        });
        return;
      }
      status='error';error='Room networking could not load.';notify();return;
    }
    if (window.SpaceSuitePeerTransport && !credentialsPrepared) {
      credentialsPrepared = true;
      window.SpaceSuitePeerTransport.prepare().finally(connect);
      return;
    }
    const host = room.role === 'host';
    let p;
    try {
      const id = host ? PREFIX+room.code : undefined;
      p = window.SpaceSuitePeerTransport ? window.SpaceSuitePeerTransport.createPeer(id) : (host ? new window.Peer(id) : new window.Peer());
    }
    catch { retry('Cannot reach room service.'); return; }
    peer = p;
    p.on('open',() => {
      if (peer !== p || connected) return;
      if (host) {
        room.claimed = true; save(); status = room.partner ? 'reconnecting' : 'waiting'; error = ''; notify();
      } else {
        status='connecting'; notify();
        try { attach(p.connect(PREFIX+room.code,{reliable:true,metadata:{v:VERSION,identity:room.identity}})); }
        catch { retry(); }
      }
    });
    p.on('connection',conn => {
      if (p !== peer || !host || conn.metadata?.v !== VERSION || !validSecret(conn.metadata?.identity)) { conn.close();return; }
      if (room.partner && room.partner !== conn.metadata.identity) {
        conn.on('open',() => { try { conn.send({v:VERSION,kind:'reject'}); } finally { setTimeout(()=>conn.close(),300); } });
        return;
      }
      detach(); attach(conn); 
    });
    p.on('error',err => {
      if (peer !== p) return;
      if (err.type === 'unavailable-id' && host && !room.claimed) { room.code=randomCode(); save(); }
      if (connected) return;
      let msg = err.type === 'peer-unavailable' ? 'Room offline. Waiting to reconnect.' : 'Reconnecting to room service.';
      if (window.SpaceSuitePeerTransport) {
        const diag = window.SpaceSuitePeerTransport.diagnosePeerError(err);
        if (diag?.en) msg = diag.en;
      }
      retry(msg);
    });
    p.on('disconnected',() => {
      if (peer !== p) return;
      if (room?.phase === 'playing') { convertToSolo('peer-disconnected'); return; }
      if (!connected) retry();
      else { try { p.reconnect(); } catch {} }
    });
    p.on('close',() => {
      if (peer === p) {
        if (room?.phase === 'playing') { convertToSolo('peer-closed'); return; }
        detach(); retry();
      }
    });
  }
  function leave(signal = true) {
    if (signal && connected && transmit('leave')) {
      // Let the ordered data channel flush the deliberate departure before closing it.
      const closingPeer = peer;
      clearTimeout(retryTimer); clearTimeout(handshakeTimer); clearInterval(heartbeat);
      peer = null; link = null; connected = false;
      setTimeout(() => { try { closingPeer.destroy(); } catch {} },400);
    } else closePeer();
    forgetSaved(); room=null; retryAttempt=0; save(); status='idle';error='';notify();
  }
  function begin(role,code,lab=null,ship=ships[0]) {
    if (room) leave();
    room={role,code,lab,identity:token(),partner:'',claimed:false,phase:'lobby',matchId:'',
      ready:[false,false],ships:[ships[0],ships[0]]};
    if (ships.includes(ship)) room.ships[role === 'host' ? 0 : 1] = ship;
    status='connecting';error='';save();notify();connect();
    return code;
  }
  function ready(value = true, ship = room?.ships[room?.role === 'host' ? 0 : 1]) {
    if (!connected || room.phase !== 'lobby' || typeof value !== 'boolean' || !ships.includes(ship)) return false;
    if (room.role === 'guest') return transmit('ready',{value,ship});
    commitReady(0,value,ship);return true;
  }
  function resetMatch() {
    if (!room || room.role !== 'host' || room.phase !== 'playing') return;
    Object.assign(room,{phase:'lobby',matchId:'',ready:[false,false]});save();sync();notify();
  }
  function stopMission() {
    if (room?.phase !== 'playing') return false;
    if (room.role === 'guest') return transmit('stop-mission',{matchId:room.matchId});
    resetMatch();
    return true;
  }
  function reconnect() { if (!connected && room) connect(); }
  window.addEventListener('online',() => { retryAttempt = 0; reconnect(); });
  window.addEventListener('offline',() => {
    if (!room) return;
    if (room.phase === 'playing') { convertToSolo('offline'); return; }
    closePeer(); status='reconnecting'; error='Network offline.'; notify();
  });
  window.addEventListener('pagehide',closePeer);
  window.addEventListener('pageshow',ev => { if (ev.persisted) reconnect(); });
  document.addEventListener('visibilitychange',() => {
    if (!document.hidden && room) { if (!connected) reconnect(); else transmit('ping'); }
  });
  window.SpaceCoop={get state(){return state();},create:(lab=null,ship)=>validLab(lab) && begin('host',randomCode(),lab,ship),
    join(code,ship){ if (!validCode(code)) return false; begin('guest',code,null,ship);return true; },
    get savedRoom() {
      const saved = readTicket('localStorage');
      return (saved && !soloMatches.has(saved.matchId)) ? {code:saved.code,role:saved.role,lab:saved.lab||null} : null;
    },
    ready,reconnect,resumeSaved,leave,resetMatch,stopMission,convertToSolo,
    isSolo: matchId => soloMatches.has(matchId),
    send(type,payload) {
      return connected && room?.phase === 'playing' && typeof type === 'string' && type.length <= 64 &&
        transmit('event',{matchId:room.matchId,type,payload});
    }};
})();
