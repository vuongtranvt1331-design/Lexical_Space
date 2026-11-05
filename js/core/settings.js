export const DEFAULT_SETTINGS = Object.freeze({
  autoPronounce: true,
  soundEffects: true,
  recallDirection: 'en-vi',
  dailyNewLimit: null,
  dailyReviewLimit: null
});
const key = username => `ls_settings_v2:${encodeURIComponent(username)}`;
const limit = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function loadSettings(username) {
  if (!username) return { ...DEFAULT_SETTINGS };
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key(username)) || '{}'); }
  catch { saved = {}; }
  const settings = sanitizeSettings(saved);
  if (typeof saved?.soundEffects !== 'boolean') {
    try { settings.soundEffects = localStorage.getItem(`ls_sound_enabled:${encodeURIComponent(username)}`) !== 'false'; }
    catch { /* Use the default if the old setting cannot be read. */ }
  }
  return settings;
}

export function sanitizeSettings(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    autoPronounce: value.autoPronounce !== false,
    soundEffects: value.soundEffects !== false,
    recallDirection: value.recallDirection === 'vi-en' ? 'vi-en' : 'en-vi',
    dailyNewLimit: limit(value.dailyNewLimit),
    dailyReviewLimit: limit(value.dailyReviewLimit)
  };
}
export function saveSettings(username, settings) {
  const value = sanitizeSettings(settings);
  if (username) localStorage.setItem(key(username), JSON.stringify(value));
  return value;
}
