import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class MockStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

class MockDataConnection {
  constructor(metadata) {
    this.metadata = metadata;
    this.open = true;
    this.listeners = {};
    this.sent = [];
    this.partner = null;
  }
  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  emit(event, ...args) {
    for (const fn of this.listeners[event] || []) fn(...args);
  }
  send(data) {
    this.sent.push(data);
    if (this.partner && this.partner.open) {
      setTimeout(() => this.partner.emit('data', data), 0);
    }
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
    if (this.partner && this.partner.open) {
      this.partner.close();
    }
  }
}

async function createCoopContext() {
  const code = await fs.readFile(new URL('../apps/space-dominators/coop-room.js', import.meta.url), 'utf8');
  const events = [];
  const eventListeners = {};
  const createdPeers = [];

  class MockPeerInstance {
    constructor(id, options) {
      this.id = id || 'peer-' + Math.random().toString(36).slice(2, 6);
      this.options = options;
      this.open = true;
      this.destroyed = false;
      this.disconnected = false;
      this.listeners = {};
      this.outgoing = null;
      createdPeers.push(this);
      setTimeout(() => this.emit('open', this.id), 0);
    }
    on(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    }
    emit(event, ...args) {
      for (const fn of this.listeners[event] || []) fn(...args);
    }
    connect(remoteId, opts = {}) {
      const conn = new MockDataConnection(opts.metadata);
      this.outgoing = conn;
      return conn;
    }
    reconnect() {}
    destroy() {
      this.destroyed = true;
      this.open = false;
      this.emit('close');
    }
  }

  const windowObj = {
    sessionStorage: new MockStorage(),
    localStorage: new MockStorage(),
    addEventListener: (type, fn) => {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(fn);
    },
    removeEventListener: (type, fn) => {
      if (eventListeners[type]) {
        eventListeners[type] = eventListeners[type].filter(cb => cb !== fn);
      }
    },
    dispatchEvent: ev => {
      events.push(ev);
      const list = eventListeners[ev.type] || [];
      for (const fn of list) fn(ev);
      return true;
    },
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    Peer: MockPeerInstance,
    crypto: globalThis.crypto
  };

  const documentObj = {
    addEventListener: (type, fn) => {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(fn);
    },
    removeEventListener: () => {},
    hidden: false
  };

  const context = vm.createContext({
    URLSearchParams,
    location: {search: ""},
    window: windowObj,
    document: documentObj,
    sessionStorage: windowObj.sessionStorage,
    localStorage: windowObj.localStorage,
    CustomEvent: windowObj.CustomEvent,
    crypto: windowObj.crypto,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: id => clearInterval(id),
    Date: globalThis.Date,
    Array: globalThis.Array,
    Object: globalThis.Object,
    Number: globalThis.Number,
    String: globalThis.String,
    JSON: globalThis.JSON,
    Set: globalThis.Set,
    Uint8Array: globalThis.Uint8Array,
    Uint32Array: globalThis.Uint32Array
  });

  vm.runInContext(code, context);
  return {
    SpaceCoop: context.window.SpaceCoop,
    context,
    events,
    windowObj,
    createdPeers,
    emitEvent: (type, ev) => {
      for (const fn of eventListeners[type] || []) fn(ev);
    }
  };
}

test('Host converts to solo when guest leaves active match', async () => {
  const hostCtx = await createCoopContext();
  const roomCode = hostCtx.SpaceCoop.create();
  assert.equal(typeof roomCode, 'string');

  await new Promise(r => setTimeout(r, 10));
  assert.equal(hostCtx.SpaceCoop.state.role, 'host');
  assert.equal(hostCtx.SpaceCoop.state.phase, 'lobby');

  const hostPeer = hostCtx.createdPeers[0];
  assert.ok(hostPeer);

  // Guest connects
  const guestSecret = '11112222333344445555666677778888';
  const conn = new MockDataConnection({ v: 6, identity: guestSecret });
  hostPeer.emit('connection', conn);
  conn.emit('data', { v: 6, kind: 'hello', identity: guestSecret });

  // Both ready up to start match
  conn.emit('data', { v: 6, kind: 'ready', value: true, ship: 'tempest' });
  hostCtx.SpaceCoop.ready(true, 'kestrel');

  assert.equal(hostCtx.SpaceCoop.state.phase, 'playing');
  const activeMatchId = hostCtx.SpaceCoop.state.matchId;
  assert.ok(activeMatchId);

  // Tickets saved
  assert.ok(hostCtx.windowObj.sessionStorage.getItem('space_dominators_room_v1'));

  // Guest leaves during match
  conn.emit('data', { v: 6, kind: 'leave' });

  // Solo signal emitted with details
  const soloEvents = hostCtx.events.filter(e => e.type === 'spacecoop:solo');
  assert.equal(soloEvents.length, 1);
  assert.equal(soloEvents[0].detail.matchId, activeMatchId);
  assert.equal(soloEvents[0].detail.role, 'host');
  assert.equal(soloEvents[0].detail.reason, 'partner-left');

  // Stale room and tickets disposed
  assert.equal(hostCtx.windowObj.sessionStorage.getItem('space_dominators_room_v1'), null);
  assert.equal(hostCtx.windowObj.localStorage.getItem('space_dominators_room_v1'), null);
  assert.equal(hostCtx.SpaceCoop.state.phase, 'lobby');
  assert.equal(hostCtx.SpaceCoop.state.matchId, '');
  assert.ok(hostCtx.SpaceCoop.isSolo(activeMatchId));

  // Late packets must not overwrite solo
  conn.emit('data', { v: 6, kind: 'event', matchId: activeMatchId, type: 'action' });
  assert.equal(hostCtx.SpaceCoop.state.matchId, '');
  assert.equal(hostCtx.events.filter(e => e.type === 'spacecoop:solo').length, 1);
});

test('Guest converts to solo when host transport is lost during active match', async () => {
  const guestCtx = await createCoopContext();
  guestCtx.SpaceCoop.join('5678');

  await new Promise(r => setTimeout(r, 10));
  assert.equal(guestCtx.SpaceCoop.state.role, 'guest');

  const guestPeer = guestCtx.createdPeers[0];
  assert.ok(guestPeer && guestPeer.outgoing);
  const conn = guestPeer.outgoing;

  // Active match state received from host
  const matchSecret = 'aaaabbbbccccddddeeeeffff00001111';
  conn.emit('data', {
    v: 6,
    kind: 'state',
    phase: 'playing',
    matchId: matchSecret,
    ready: [true, true],
    ships: ['kestrel', 'spectre'],
    lab: null
  });

  assert.equal(guestCtx.SpaceCoop.state.phase, 'playing');
  assert.equal(guestCtx.SpaceCoop.state.matchId, matchSecret);

  // Transport lost: connection closes
  conn.emit('close');

  const soloEvents = guestCtx.events.filter(e => e.type === 'spacecoop:solo');
  assert.equal(soloEvents.length, 1);
  assert.equal(soloEvents[0].detail.matchId, matchSecret);
  assert.equal(soloEvents[0].detail.role, 'guest');
  assert.equal(soloEvents[0].detail.reason, 'transport-lost');

  // Tickets cleared
  assert.equal(guestCtx.windowObj.sessionStorage.getItem('space_dominators_room_v1'), null);
  assert.equal(guestCtx.SpaceCoop.state.matchId, '');
  assert.ok(guestCtx.SpaceCoop.isSolo(matchSecret));
});

test('Idempotency: multiple disconnects or packets do not re-emit spacecoop:solo', async () => {
  const ctx = await createCoopContext();
  ctx.SpaceCoop.join('9999');
  await new Promise(r => setTimeout(r, 10));

  const matchSecret = 'ababcdcd12123434ababcdcd12123434';
  const conn = ctx.createdPeers[0].outgoing;
  conn.emit('data', {
    v: 6,
    kind: 'state',
    phase: 'playing',
    matchId: matchSecret,
    ready: [true, true],
    ships: ['kestrel', 'aegis'],
    lab: null
  });

  // Call convertToSolo directly twice and then close connection
  ctx.SpaceCoop.convertToSolo('test-1');
  ctx.SpaceCoop.convertToSolo('test-2');
  conn.emit('close');

  const soloEvents = ctx.events.filter(e => e.type === 'spacecoop:solo');
  assert.equal(soloEvents.length, 1);
});

test('Intentional local leave does not emit spacecoop:solo locally but transmits leave', async () => {
  const ctx = await createCoopContext();
  ctx.SpaceCoop.join('7777');
  await new Promise(r => setTimeout(r, 10));

  const matchSecret = '99998888777766665555444433332222';
  const conn = ctx.createdPeers[0].outgoing;
  conn.emit('data', {
    v: 6,
    kind: 'state',
    phase: 'playing',
    matchId: matchSecret,
    ready: [true, true],
    ships: ['kestrel', 'tempest'],
    lab: null
  });

  assert.equal(ctx.SpaceCoop.state.phase, 'playing');

  // Local intentional leave
  ctx.SpaceCoop.leave(true);

  // Local solo event must NOT be emitted
  const soloEvents = ctx.events.filter(e => e.type === 'spacecoop:solo');
  assert.equal(soloEvents.length, 0);

  // Leave wire packet must have been sent
  assert.ok(conn.sent.some(p => p.kind === 'leave'));
  assert.equal(ctx.SpaceCoop.state.phase, 'lobby');
});

test('Lobby disconnect does not emit spacecoop:solo (waiting-room recovery kept)', async () => {
  const ctx = await createCoopContext();
  ctx.SpaceCoop.join('3333');
  await new Promise(r => setTimeout(r, 10));

  assert.equal(ctx.SpaceCoop.state.phase, 'lobby');

  const conn = ctx.createdPeers[0].outgoing;
  conn.emit('close');

  const soloEvents = ctx.events.filter(e => e.type === 'spacecoop:solo');
  assert.equal(soloEvents.length, 0);
  assert.equal(ctx.SpaceCoop.state.status, 'reconnecting');
  ctx.SpaceCoop.leave();
});
