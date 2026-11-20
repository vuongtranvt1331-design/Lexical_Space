import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadTransportModule(customContext = {}) {
  const code = await fs.readFile(new URL('../suite/js/peer-transport.js', import.meta.url), 'utf8');
  const windowObj = {
    location: { pathname: '/apps/quick-drawn/index.html', search: '' },
    navigator: { onLine: true },
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    ...customContext
  };

  const context = vm.createContext({
    window: windowObj,
    location: windowObj.location,
    navigator: windowObj.navigator,
    document: {
      head: {
        appendChild: () => {}
      },
      createElement: () => ({ set src(v) {}, set async(v) {} })
    },
    fetch: customContext.fetch || globalThis.fetch,
    AbortController: globalThis.AbortController,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    Date: globalThis.Date,
    Math: globalThis.Math,
    JSON: globalThis.JSON,
    Array: globalThis.Array,
    Object: globalThis.Object,
    Promise: globalThis.Promise,
    Error: globalThis.Error,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams
  });

  vm.runInContext(code, context);
  return { transport: context.window.SpaceSuitePeerTransport, context };
}

test('SpaceSuitePeerTransport provides default multi-STUN configuration', async () => {
  const { transport } = await loadTransportModule();
  assert.ok(transport);
  const servers = transport.getIceServersSync();
  assert.ok(Array.isArray(servers) && servers.length >= 2);
  const allUrls = servers.flatMap(s => s.urls);
  assert.ok(allUrls.some(u => u.includes('stun.l.google.com')));
  assert.ok(allUrls.some(u => u.includes('cloudflare.com')));

  const rtcConfig = transport.buildRtcConfig();
  assert.equal(rtcConfig.sdpSemantics, 'unified-plan');
  assert.deepEqual(rtcConfig.iceServers, servers);
  assert.equal(rtcConfig.iceTransportPolicy, undefined);
});

test('SpaceSuitePeerTransport enforces relay-only when requested', async () => {
  const { transport } = await loadTransportModule();
  assert.equal(transport.isRelayOnly(), false);

  transport.setRelayOnly(true);
  assert.equal(transport.isRelayOnly(), true);

  const rtcConfig = transport.buildRtcConfig();
  assert.equal(rtcConfig.iceTransportPolicy, 'relay');

  transport.setRelayOnly(false);
  assert.equal(transport.buildRtcConfig().iceTransportPolicy, undefined);
});

test('SpaceSuitePeerTransport backoffDelay computes exponential jittered delays within bounds', async () => {
  const { transport } = await loadTransportModule();
  const d0 = transport.backoffDelay(0);
  const d1 = transport.backoffDelay(1);
  const d4 = transport.backoffDelay(4);
  const d10 = transport.backoffDelay(10);

  assert.ok(d0 >= 1200 && d0 <= 1700, `d0 was ${d0}`);
  assert.ok(d1 >= 1800 && d1 <= 2300, `d1 was ${d1}`);
  assert.ok(d4 >= d1, `d4 (${d4}) should be >= d1 (${d1})`);
  assert.ok(d10 <= 10000, `d10 (${d10}) should not exceed maxMs 10000`);
});

test('diagnosePeerError classifies peer errors and network timeouts into actionable messages', async () => {
  const { transport } = await loadTransportModule();

  const unavailable = transport.diagnosePeerError({ type: 'peer-unavailable' });
  assert.equal(unavailable.code, 'PEER_UNAVAILABLE');
  assert.match(unavailable.actionable, /Không tìm thấy phòng/);

  const inUse = transport.diagnosePeerError({ type: 'unavailable-id' });
  assert.equal(inUse.code, 'UNAVAILABLE_ID');
  assert.match(inUse.actionable, /đang được sử dụng/);

  const timeout = transport.diagnosePeerError({ type: 'ice-timeout' });
  assert.equal(timeout.code, 'ICE_TIMEOUT');
  assert.match(timeout.actionable, /NAT nhà mạng|tường lửa/);
  assert.match(timeout.en, /carrier NAT or firewall/i);
});

test('diagnostics report never exposes endpoint URL or credentials', async () => {
  const { transport } = await loadTransportModule();
  const report = transport.getDiagnosticReport();
  assert.equal(typeof report.hasEndpoint, 'boolean');
  assert.equal(typeof report.cachedCredentialsCount, 'number');
  assert.equal(report.endpoint, undefined);
  assert.equal(report.url, undefined);
  assert.equal(report.credentials, undefined);
});

test('createPeer configures Peer instance with merged RTC config', async () => {
  class MockPeer {
    constructor(idOrOptions, maybeOptions) {
      if (typeof idOrOptions === 'string') {
        this.id = idOrOptions;
        this.options = maybeOptions;
      } else {
        this.id = undefined;
        this.options = idOrOptions;
      }
    }
  }

  const { transport } = await loadTransportModule({
    Peer: MockPeer
  });

  const hostPeer = transport.createPeer('room-1234', { reliable: true });
  assert.equal(hostPeer.id, 'room-1234');
  assert.equal(hostPeer.options.reliable, true);
  assert.ok(hostPeer.options.config.iceServers.length >= 2);

  const guestPeer = transport.createPeer({ reliable: true });
  assert.equal(guestPeer.id, undefined);
  assert.equal(guestPeer.options.reliable, true);
  assert.ok(guestPeer.options.config.iceServers.length >= 2);
});

test('prepare and fetchIceCredentials gracefully fall back on network failure without blocking', async () => {
  const failingFetch = async () => {
    throw new Error('Connection refused');
  };

  const { transport } = await loadTransportModule({
    fetch: failingFetch
  });

  // Transport configure with dummy endpoint to test fallback
  transport.configure({ endpoint: 'https://invalid.local/rtc', resetCache: true });
  const servers = await transport.prepare();
  // Safe fallback to default STUN
  assert.ok(Array.isArray(servers) && servers.length >= 2);
  assert.ok(servers[0].urls[0].includes('stun:'));
});

test('bounded fetch validates body and caches valid credentials', async () => {
  const mockServers = [
    { urls: 'stun:stun.custom.com:3478' },
    { urls: 'turn:turn.custom.com:443?transport=tcp', username: 'user1', credential: 'secret-token' }
  ];

  const validFetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({ iceServers: mockServers, ttl: 3600 })
  });

  const { transport } = await loadTransportModule({
    fetch: validFetch
  });

  transport.configure({ endpoint: 'https://trusted.local/rtc', resetCache: true });
  const servers = await transport.prepare();
  assert.equal(servers.length, 2);
  assert.equal(servers[1].urls, 'turn:turn.custom.com:443?transport=tcp');

  const report = transport.getDiagnosticReport();
  assert.equal(report.cachedCredentialsCount, 2);
  assert.equal(report.hasEndpoint, true);
});

test('multi-peer connection simulation exchanges data and preserves payload integrity', async () => {
  const { transport } = await loadTransportModule();

  // Create an EventEmitter-like mock for Peer and DataConnection
  class MockConnection {
    constructor(peer, remoteId, metadata) {
      this.peer = peer;
      this.remoteId = remoteId;
      this.metadata = metadata;
      this.open = false;
      this.listeners = {};
    }
    on(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    }
    emit(event, ...args) {
      for (const fn of this.listeners[event] || []) fn(...args);
    }
    send(data) {
      if (this.partner) {
        this.partner.emit('data', data);
      }
    }
    close() {
      this.open = false;
      this.emit('close');
    }
  }

  class MockPeer {
    constructor(idOrOptions, maybeOptions) {
      if (typeof idOrOptions === 'string') {
        this.id = idOrOptions;
        this.options = maybeOptions;
      } else {
        this.id = 'assigned-' + Math.random().toString(36).slice(2, 6);
        this.options = idOrOptions;
      }
      this.open = true;
      this.listeners = {};
      setTimeout(() => this.emit('open', this.id), 0);
    }
    on(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    }
    emit(event, ...args) {
      for (const fn of this.listeners[event] || []) fn(...args);
    }
    connect(targetId, opts = {}) {
      const conn = new MockConnection(this, targetId, opts.metadata);
      const partner = new MockConnection(null, this.id, opts.metadata);
      conn.partner = partner;
      partner.partner = conn;
      setTimeout(() => {
        conn.open = true;
        partner.open = true;
        conn.emit('open');
        partner.emit('open');
      }, 5);
      return conn;
    }
    destroy() {
      this.open = false;
      this.emit('close');
    }
  }

  const { transport: activeTransport } = await loadTransportModule({
    Peer: MockPeer
  });

  const hostPeer = activeTransport.createPeer('anhhung-chess-1234');
  const guestPeer = activeTransport.createPeer();

  assert.equal(hostPeer.options.config.sdpSemantics, 'unified-plan');
  assert.equal(guestPeer.options.config.sdpSemantics, 'unified-plan');

  const guestConn = guestPeer.connect('anhhung-chess-1234', { reliable: true });
  const receivedMessages = [];

  await new Promise(resolve => {
    guestConn.on('open', () => {
      guestConn.partner.on('data', data => {
        receivedMessages.push(data);
        if (data.type === 'MOVE') {
          guestConn.partner.send({ type: 'ACK', move: data.move });
        }
      });

      guestConn.on('data', data => {
        receivedMessages.push(data);
        if (data.type === 'ACK') {
          resolve();
        }
      });

      guestConn.send({ type: 'MOVE', move: 'e2e4' });
    });
  });

  assert.equal(receivedMessages.length, 2);
  assert.deepEqual(receivedMessages[0], { type: 'MOVE', move: 'e2e4' });
  assert.deepEqual(receivedMessages[1], { type: 'ACK', move: 'e2e4' });
});

