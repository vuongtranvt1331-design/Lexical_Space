    const FIREBASE_SETTINGS_KEY = 'grammarSpace_firebase_config';
    function validateFirebaseSettings(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Vui lòng nhập cấu hình dưới dạng một đối tượng JSON.');
      const config = {};
      ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId'].forEach(key => {
        if (typeof value[key] === 'string' && value[key].trim()) config[key] = value[key].trim();
      });
      if (!['apiKey', 'authDomain', 'projectId'].every(key => config[key] && !config[key].startsWith('YOUR_'))) throw new Error('Cấu hình cần apiKey, authDomain và projectId của dự án Firebase.');
      return config;
    }
    function readFirebaseSettings() {
      try { return validateFirebaseSettings(window.GRAMMARSPACE_FIREBASE_CONFIG || JSON.parse(localStorage.getItem(FIREBASE_SETTINGS_KEY) || '{}')); }
      catch { return {}; }
    }




let config = readFirebaseSettings();
let database = null;
export const getFirebaseConfig = () => config;
export { validateFirebaseSettings };
export function setFirebaseConfig(value) { config = validateFirebaseSettings(value); database = null; return config; }
export function saveFirebaseConfig(value) {
  const valid = validateFirebaseSettings(value);
  let saved = true;
  try { localStorage.setItem(FIREBASE_SETTINGS_KEY, JSON.stringify(valid)); } catch { saved = false; }
  setFirebaseConfig(valid);
  return saved;
}
export function firebaseIsConfigured() {
  return ['apiKey', 'authDomain', 'projectId'].every(key => typeof config[key] === 'string' && config[key].trim() && !config[key].includes('YOUR_'));
}
export function withDeadline(promise, milliseconds) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Request timed out'), { code: 'deadline-exceeded' })), milliseconds); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function configKey(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
export async function getUpdatesDatabase() {
  if (!window.firebase?.initializeApp || !window.firebase?.firestore) throw Object.assign(new Error('Firebase SDK unavailable'), { code: 'sdk-unavailable' });
  if (!database) {
    const name = 'grammarspace-student-' + configKey(JSON.stringify(config));
    const app = window.firebase.apps.find(item => item.name === name) || window.firebase.initializeApp(config, name);
    database = app.firestore();
  }
  return database;
}
export async function fetchNewUpdates() {
  const db = await getUpdatesDatabase();
  return withDeadline(db.collection('new_updates').get({ source: 'server' }), 15000);
}
export async function streamNewUpdates(onSnapshot, onError) {
  const db = await getUpdatesDatabase();
  return db.collection('new_updates').onSnapshot(onSnapshot, onError);
}
