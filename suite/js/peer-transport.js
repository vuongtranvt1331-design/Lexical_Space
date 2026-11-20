/**
 * suite/js/peer-transport.js
 * Integrated SpaceSuite WebRTC / PeerJS network transport layer.
 * 
 * Provides:
 * - Resilient PeerJS library loader with vendored fallback.
 * - Multi-STUN fallback + optional HTTPS credentials endpoint for ephemeral TURN (TLS/TCP 443).
 * - Jittered exponential backoff and bounded per-attempt timing.
 * - Actionable diagnostics for Carrier-Grade NAT (CGNAT) and UDP-blocked networks.
 * - Relay-only testing support without hardcoded credentials.
 */
(() => {
  'use strict';

  const DEFAULT_STUN_SERVERS = Object.freeze([
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun2.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }
  ]);

  const DEFAULT_DEPLOYMENT_ENDPOINT = "https://spacesuitstudysessions.metered.live/api/v1/turn/credentials?apiKey=54dec9c38767a213e02ea2059268a541f685";
  let customEndpoint = null;
  let customIceServers = null;
  let cachedCredentials = null;
  let cachedExpiry = 0;
  let relayOnlyOverride = null;
  let peerLoaderPromise = null;

  function resolveVendoredPeerPath() {
    if (typeof window !== 'undefined' && window.SpaceSuite?.base) {
      try {
        return new URL('apps/space-dominators/vendor/peerjs.min.js', window.SpaceSuite.base).href;
      } catch (_) {}
    }
    if (typeof location !== 'undefined') {
      if (location.pathname.includes('/apps/space-dominators/')) {
        return './vendor/peerjs.min.js';
      }
      if (location.pathname.includes('/apps/')) {
        return '../space-dominators/vendor/peerjs.min.js';
      }
    }
    return 'apps/space-dominators/vendor/peerjs.min.js';
  }

  function ensurePeer() {
    if (typeof window !== 'undefined' && typeof window.Peer === 'function') {
      return Promise.resolve(window.Peer);
    }
    if (peerLoaderPromise) return peerLoaderPromise;

    peerLoaderPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        reject(new Error('Browser environment required for PeerJS'));
        return;
      }
      const script = document.createElement('script');
      script.src = resolveVendoredPeerPath();
      script.async = true;
      script.onload = () => {
        if (typeof window.Peer === 'function') resolve(window.Peer);
        else reject(new Error('PeerJS script loaded but window.Peer is undefined'));
      };
      script.onerror = () => {
        peerLoaderPromise = null;
        reject(new Error('Failed to load vendored PeerJS fallback'));
      };
      document.head.appendChild(script);
    });

    return peerLoaderPromise;
  }

  function getEndpointUrl() {
    if (customEndpoint) return customEndpoint;
    if (typeof window !== 'undefined') {
      if (typeof window.SPACESUITE_RTC_ENDPOINT === 'string' && window.SPACESUITE_RTC_ENDPOINT) {
        return window.SPACESUITE_RTC_ENDPOINT;
      }
      if (typeof window.SPACESUITE_TURN_ENDPOINT === 'string' && window.SPACESUITE_TURN_ENDPOINT) {
        return window.SPACESUITE_TURN_ENDPOINT;
      }
    }
    return DEFAULT_DEPLOYMENT_ENDPOINT || null;
  }

  function isRelayOnly() {
    if (typeof relayOnlyOverride === 'boolean') return relayOnlyOverride;
    if (typeof window !== 'undefined' && typeof window.SPACESUITE_RELAY_ONLY === 'boolean') {
      return window.SPACESUITE_RELAY_ONLY;
    }
    return false;
  }

  async function fetchIceCredentials(endpointUrl) {
    if (!endpointUrl || typeof fetch === 'undefined') return null;
    const now = Date.now();
    if (cachedCredentials && now < cachedExpiry) {
      return cachedCredentials;
    }

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 1800) : null;
      const response = await fetch(endpointUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller?.signal
      });
      if (timeout) clearTimeout(timeout);

      if (response.ok) {
        const text = await response.text();
        if (text && text.length <= 16384) {
          const data = JSON.parse(text);
          let servers = null;
          if (Array.isArray(data)) servers = data;
          else if (data && Array.isArray(data.iceServers)) servers = data.iceServers;

          if (servers && servers.length > 0) {
            const valid = servers.filter(s => s && (s.urls || s.url));
            if (valid.length > 0) {
              const ttlSeconds = Number(data?.ttl);
              const ttlMs = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : 600000;
              cachedCredentials = valid;
              cachedExpiry = now + ttlMs;
              return valid;
            }
          }
        }
      }
    } catch (_) {
      // Endpoint unavailable or timed out; seamless direct fallback to STUN.
    }
    return null;
  }

  function getIceServersSync() {
    if (customIceServers && customIceServers.length > 0) return customIceServers;
    if (cachedCredentials && Date.now() < cachedExpiry) return cachedCredentials;
    return DEFAULT_STUN_SERVERS;
  }

  async function getIceServersAsync() {
    if (customIceServers && customIceServers.length > 0) return customIceServers;
    const endpoint = getEndpointUrl();
    if (endpoint) {
      const fetched = await fetchIceCredentials(endpoint);
      if (fetched && fetched.length > 0) return fetched;
    }
    return getIceServersSync();
  }

  function buildRtcConfig(userConfig = {}) {
    const servers = getIceServersSync();
    const config = {
      iceServers: servers,
      sdpSemantics: 'unified-plan',
      ...userConfig
    };
    if (isRelayOnly() && !config.iceTransportPolicy) {
      config.iceTransportPolicy = 'relay';
    }
    return config;
  }

  function createPeer(idOrOptions, maybeOptions = {}) {
    if (typeof window === 'undefined' || typeof window.Peer !== 'function') {
      throw new Error('PeerJS is not loaded. Call SpaceSuitePeerTransport.ensurePeer() first.');
    }

    let id = undefined;
    let userOptions = {};

    if (typeof idOrOptions === 'string') {
      id = idOrOptions;
      userOptions = maybeOptions || {};
    } else if (typeof idOrOptions === 'object' && idOrOptions !== null) {
      userOptions = idOrOptions;
    }

    const mergedConfig = buildRtcConfig(userOptions.config || {});
    const finalOptions = {
      ...userOptions,
      config: mergedConfig
    };

    return id ? new window.Peer(id, finalOptions) : new window.Peer(finalOptions);
  }

  function backoffDelay(attempt, baseMs = 1200, maxMs = 10000, factor = 1.5) {
    const safeAttempt = Math.max(0, Math.min(attempt, 8));
    const exp = Math.min(maxMs, baseMs * Math.pow(factor, safeAttempt));
    const jitter = Math.floor(Math.random() * 350);
    return Math.min(maxMs, Math.round(exp + jitter));
  }

  function diagnosePeerError(err, context = {}) {
    const type = err?.type || '';
    switch (type) {
      case 'peer-unavailable':
        return {
          code: 'PEER_UNAVAILABLE',
          actionable: 'Không tìm thấy phòng. Đảm bảo mã phòng đúng và đối thủ đang mở phòng.',
          en: 'Room not found. Check the room code and ensure host is ready.'
        };
      case 'unavailable-id':
        return {
          code: 'UNAVAILABLE_ID',
          actionable: 'Mã phòng đang được sử dụng. Đang tự động thử mã khác…',
          en: 'Room code in use. Trying another code…'
        };
      case 'network':
        return {
          code: 'NETWORK_ERROR',
          actionable: 'Mất kết nối máy chủ phòng (PeerServer). Đang kiểm tra lại mạng…',
          en: 'Signaling server unreachable. Checking network…'
        };
      case 'browser-incompatible':
        return {
          code: 'BROWSER_INCOMPATIBLE',
          actionable: 'Trình duyệt không hỗ trợ WebRTC P2P.',
          en: 'Browser does not support WebRTC.'
        };
      case 'timeout':
      case 'ice-timeout':
        return {
          code: 'ICE_TIMEOUT',
          actionable: 'Kết nối quá hạn (NAT nhà mạng/tường lửa chặn P2P). Hãy thử đổi Wi-Fi hoặc dùng relay TURN.',
          en: 'Connection timed out. Mobile carrier NAT or firewall blocked direct P2P.'
        };
      default:
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return {
            code: 'OFFLINE',
            actionable: 'Thiết bị đang mất mạng. Vui lòng kiểm tra Wi-Fi hoặc 4G.',
            en: 'Device is offline. Check your network connection.'
          };
        }
        return {
          code: 'GENERIC',
          actionable: 'Không kết nối được. Kiểm tra mạng, thử lại hoặc đổi mạng.',
          en: 'Connection error. Check network and retry.'
        };
    }
  }

  function configure(options = {}) {
    if (typeof options.endpoint === 'string') customEndpoint = options.endpoint;
    if (Array.isArray(options.iceServers)) customIceServers = options.iceServers;
    if (typeof options.relayOnly === 'boolean') relayOnlyOverride = options.relayOnly;
    if (options.resetCache) {
      cachedCredentials = null;
      cachedExpiry = 0;
    }
  }

  let preparePromise = null;
  function prepare() {
    if (cachedCredentials && Date.now() < cachedExpiry) return Promise.resolve(cachedCredentials);
    if (!preparePromise) {
      preparePromise = getIceServersAsync().finally(() => { preparePromise = null; });
    }
    return preparePromise;
  }

  function getDiagnosticReport() {
    return {
      peerLoaded: typeof window !== 'undefined' && typeof window.Peer === 'function',
      hasEndpoint: !!getEndpointUrl(),
      cachedCredentialsCount: cachedCredentials ? cachedCredentials.length : 0,
      cachedExpiry: cachedExpiry > 0 ? new Date(cachedExpiry).toISOString() : null,
      relayOnly: isRelayOnly(),
      online: typeof navigator !== 'undefined' ? navigator.onLine : null
    };
  }

  // Pre-warm credentials fetch in the background if an endpoint is configured.
  if (typeof window !== 'undefined') {
    prepare();
  }

  const SpaceSuitePeerTransport = Object.freeze({
    DEFAULT_STUN_SERVERS,
    ensurePeer,
    prepare,
    createPeer,
    buildRtcConfig,
    getIceServersSync,
    getIceServersAsync,
    fetchIceCredentials,
    backoffDelay,
    diagnosePeerError,
    configure,
    setRelayOnly: value => { relayOnlyOverride = !!value; },
    isRelayOnly,
    getDiagnosticReport
  });

  if (typeof window !== 'undefined') {
    window.SpaceSuitePeerTransport = SpaceSuitePeerTransport;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpaceSuitePeerTransport;
  }
})();
