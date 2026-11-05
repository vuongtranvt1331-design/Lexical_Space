import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, sanitizeSettings } from '../js/core/settings.js';
import { SoundManager } from '../js/core/sound-manager.js';

test('practice limits and sound preferences are per profile and keep the old mute preference', () => {
  const values = new Map([['ls_sound_enabled:Profile%20A', 'false']]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  });

  const initial = loadSettings('Profile A');
  assert.equal(initial.soundEffects, false);
  assert.equal(initial.dailyNewLimit, null);
  assert.equal(initial.dailyReviewLimit, null);
  const updated = { ...initial, dailyNewLimit: 0, dailyReviewLimit: 12, autoPronounce: false, recallDirection: 'vi-en' };
  saveSettings('Profile A', updated);
  assert.deepEqual(loadSettings('Profile A'), updated);
  assert.deepEqual(loadSettings('Profile B'), DEFAULT_SETTINGS);

  SoundManager.loadForUser('Profile A');
  assert.equal(SoundManager.enabled, false);
  SoundManager.loadForUser('Profile B');
  assert.equal(SoundManager.enabled, true);
  saveSettings('Profile A', { ...updated, soundEffects: true });
  SoundManager.loadForUser('Profile A');
  assert.equal(SoundManager.enabled, true);

  const invalid = sanitizeSettings({ dailyNewLimit: -1, dailyReviewLimit: 1.5 });
  assert.equal(invalid.dailyNewLimit, null);
  assert.equal(invalid.dailyReviewLimit, null);
});
