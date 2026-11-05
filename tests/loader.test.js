import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url), { JSDOM } = require('jsdom');
const code = await fs.readFile(new URL('../js/features/loading.js', import.meta.url), 'utf8');
const failsafeCode = await fs.readFile(new URL('../js/features/loading-failsafe.js', import.meta.url), 'utf8');
function fixture(ready = false) {
  const dom = new JSDOM('<body><section id="space-loader"><span data-loader-text></span></section><main><button>App</button></main></body>', { runScripts: 'outside-only' });
  const { window } = dom, timers = [], intervals = [], cleared = [];
  window.__lexicalSpaceReady = ready;
  window.setInterval = (fn, delay) => { intervals.push({ fn, delay }); return 1; }; window.clearInterval = id => cleared.push(id);
  window.setTimeout = (fn, delay) => { timers.push({ fn, delay }); return 2; }; window.clearTimeout = () => {};
  window.eval(code); window.SpaceLoader.mount();
  return { dom, window, timers, intervals, cleared };
}
test('loader starts typing immediately and storage readiness dismisses it without waiting for the text', () => {
  const f = fixture(); let interactive = 0; f.window.document.addEventListener('lexicalspace:interactive', () => interactive++);
  assert.equal(f.window.document.querySelector('[data-loader-text]').textContent, 'L');
  assert.equal(f.intervals[0].delay, 35); assert.equal(f.window.document.querySelector('main').inert, true);
  f.window.document.dispatchEvent(new f.window.CustomEvent('lexicalspace:ready', { detail: { storageReady: true } }));
  assert.equal(f.window.document.getElementById('space-loader').classList.contains('is-ready'), true);
  assert.equal(!!f.window.document.querySelector('main').inert, false); assert.equal(interactive, 1); assert.ok(f.cleared.length);
  assert.equal(f.timers[0].delay, 180); f.timers[0].fn(); assert.equal(f.window.document.getElementById('space-loader'), null); assert.equal(interactive, 1);
  f.dom.window.close();
});
test('readiness that occurs before the loader mounts still dismisses it immediately', () => {
  const f = fixture(true); assert.equal(f.window.document.getElementById('space-loader').classList.contains('is-ready'), true);
  assert.equal(f.timers[0].delay, 180); f.dom.window.close();
});
test('page exit clears startup resources and restores app surfaces', () => {
  const f = fixture(); f.window.dispatchEvent(new f.window.Event('pagehide'));
  assert.equal(f.window.document.getElementById('space-loader'), null); assert.equal(!!f.window.document.querySelector('main').inert, false); assert.ok(f.cleared.length);
  f.dom.window.close();
});
test('the startup failsafe gives an actionable message if the app module never loads', () => {
  const markup = '<body><section id="space-loader"></section><p id="login-status" hidden></p><a id="link-startup-reload" hidden></a></body>';
  for (const [url, message, reloadVisible] of [
    ['https://lexicalspace.example/', /Reload the page/, true],
    ['file:///C:/LexicalSpace/index.html', /local launcher/, false],
  ]) {
    const { window } = new JSDOM(markup, { url, runScripts: 'outside-only' });
    let failStartup;
    window.setTimeout = callback => { failStartup = callback; return 1; };
    window.eval(failsafeCode);
    failStartup();
    assert.equal(window.document.getElementById('space-loader'), null);
    assert.match(window.document.getElementById('login-status').textContent, message);
    assert.equal(window.document.getElementById('link-startup-reload').hidden, !reloadVisible);
    window.close();
  }
});
test('a failed local module is reported before the startup watchdog', () => {
  const markup = '<body><section id="space-loader"></section><p id="login-status" hidden></p>' +
    '<a id="link-startup-reload" hidden></a><script id="lexicalspace-app"></script></body>';
  const { window } = new JSDOM(markup, { url: 'http://127.0.0.1:8780/', runScripts: 'outside-only' });
  window.eval(failsafeCode);
  window.document.getElementById('lexicalspace-app').dispatchEvent(new window.Event('error'));
  assert.equal(window.document.getElementById('space-loader'), null);
  assert.match(window.document.getElementById('login-status').textContent, /required LexicalSpace file could not load/);
  assert.equal(window.document.getElementById('link-startup-reload').hidden, false);
  window.close();
});
