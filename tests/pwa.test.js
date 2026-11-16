import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');

test('PWA identity, launch URL and icons resolve inside the GitHub Pages subpath', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  const hosted = new URL('https://vuongtranvt1331-design.github.io/Lexical_Space/manifest.webmanifest');
  for (const field of ['id', 'start_url', 'scope']) {
    assert.equal(new URL(manifest[field], hosted).href, 'https://vuongtranvt1331-design.github.io/Lexical_Space/');
    assert.equal(new URL(manifest[field], 'http://localhost:8780/manifest.webmanifest').pathname, '/');
  }
  assert.equal(manifest.name, 'LexicalSpace');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.theme_color, '#4255ff');
  assert.equal(manifest.background_color, '#f6f7fb');
  const html = await read('index.html');
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /<meta name="theme-color" content="#4255ff"/);
  for (const purpose of ['any', 'maskable']) for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.purpose === purpose && icon.sizes === `${size}x${size}`);
    assert.ok(icon, `${purpose} ${size} icon must exist`);
    assert.equal(icon.type, 'image/png');
    assert.ok(new URL(icon.src, hosted).pathname.startsWith('/Lexical_Space/assets/icons/'));
    const data = await fs.readFile(new URL(icon.src, root));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(data.readUInt32BE(16), size);
    assert.equal(data.readUInt32BE(20), size);
  }
});

test('worker precaches PWA resources and activation only retires its own previous shell', async () => {
  const script = await read('service-worker.js');
  const prefix = 'lexicalspace-shell-%2FLexical_Space%2F-';
  const version = script.match(/const VERSION='([^']+)'/)[1];
  const core = JSON.parse(script.match(/const CORE=(\[.*?\]);/s)[1]);
  assert.ok(core.includes('./manifest.webmanifest'));
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  for (const icon of manifest.icons) assert.ok(core.includes(icon.src));
  for (const item of core) if (item !== './') await fs.access(new URL(item, root));
  const deleted = [], added = [], handlers = {};
  let claimed = 0;
  vm.runInNewContext(script, {
    URL, Request,
    self: { registration: { scope: 'https://example.test/Lexical_Space/' },
      addEventListener: (type, handler) => { handlers[type] = handler; },
      skipWaiting: async () => {}, clients: { claim: async () => { claimed++; } } },
    caches: {
      open: async name => { assert.equal(name, prefix + version); return { addAll: async urls => { added.push(...urls); } }; },
      keys: async () => [prefix + 'old', prefix + version, 'another-app-cache', 'lexicalspace-shell-%2FOtherApp%2F-old'],
      delete: async name => { deleted.push(name); }
    }
  });
  let pending;
  handlers.install({ waitUntil: promise => { pending = promise; } }); await pending;
  assert.deepEqual(added.map(request => request.url), core.map(path => new URL(path, 'https://example.test/Lexical_Space/').href));
  assert.ok(added.every(request => request.cache === 'reload'), 'a new shell must bypass stale HTTP cache');
  handlers.activate({ waitUntil: promise => { pending = promise; } }); await pending;
  assert.deepEqual(deleted, [prefix + 'old']);
  assert.equal(claimed, 1);
  assert.doesNotMatch(script, /indexedDB|localStorage|\.unregister\(/);
});
