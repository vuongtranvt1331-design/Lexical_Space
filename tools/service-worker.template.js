/* One worker for the installed suite; runtime media is cached after it is used. */
const VERSION='__VERSION__';
const BASE = new URL('./', self.registration.scope);
const PREFIX = 'lexicalspace-shell-' + encodeURIComponent(BASE.pathname) + '-';
const SHELL = PREFIX + VERSION;
const MEDIA = PREFIX + 'media-v1';
const CORE=__CORE__;
const EXTERNAL = ['https://cdn.tailwindcss.com', 'https://unpkg.com/@phosphor-icons/web', 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(SHELL);
  await cache.addAll(CORE.map(path => new Request(new URL(path, BASE), { cache: 'reload' })));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Own versioned shell caches only. Never delete IndexedDB or another app's caches.
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== SHELL && key !== MEDIA) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request; if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const local = url.origin === BASE.origin && url.pathname.startsWith(BASE.pathname);
  const external = EXTERNAL.some(value => {
    const allowed = new URL(value);
    return url.origin === allowed.origin && (url.pathname === allowed.pathname ||
      allowed.pathname !== '/' && (url.pathname.startsWith(allowed.pathname + '/') || url.pathname.startsWith(allowed.pathname + '@')));
  });
  if (!local && !external) return; // Firestore, PeerJS, pronunciation and other APIs stay untouched.
  const key = local ? new URL(url.pathname, BASE.origin).href : url.href;
  event.respondWith((async () => {
    const shell = await caches.open(SHELL), media = await caches.open(MEDIA);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok || response.type === 'opaque') {
        const target = external || CORE.some(path => new URL(path, BASE).href === key) ? shell : media;
        try { await target.put(key, response.clone()); } catch { /* Storage pressure must not block the live response. */ }
      }
      return response;
    } catch {
      let cached = await shell.match(key) || await media.match(key);
      if (!cached && local && url.pathname.endsWith('/')) cached = await shell.match(new URL('index.html', key).href);
      if (cached) return cached;
      if (local && request.mode === 'navigate') return await shell.match(new URL('offline.html', BASE).href) || Response.error();
      return Response.error();
    }
  })());
});
