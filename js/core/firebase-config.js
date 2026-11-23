const firebaseConfig = {
      apiKey: "AIzaSyCAejXQfHKQ0ZKTpR7kphaDFCGqCcuoRfI",
      authDomain: "home-page-d6c39.firebaseapp.com",
      projectId: "home-page-d6c39",
      storageBucket: "home-page-d6c39.firebasestorage.app",
      messagingSenderId: "916831594708",
      appId: "1:916831594708:web:64d97a5a3b8872f7173341"
    };

const SDK_BASE = 'https://www.gstatic.com/firebasejs/10.8.0/';

function loadScript(file) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = SDK_BASE + file;
    function finish(error) {
      window.clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove(); reject(error); }
      else resolve();
    }
    const unavailable = () => finish(new Error('Firebase SDK could not load: ' + file));
    const timer = window.setTimeout(unavailable, 4500);
    script.onload = () => finish();
    script.onerror = unavailable;
    document.head.append(script);
  });
}

export async function openFirebaseServices() {
  if (!globalThis.firebase) await loadScript('firebase-app-compat.js');
  if (!globalThis.firebase) throw new Error('Firebase SDK is unavailable.');
  if (typeof globalThis.firebase.firestore !== 'function') await loadScript('firebase-firestore-compat.js');
  const sdk = globalThis.firebase;
  if (!sdk.apps.length) sdk.initializeApp(firebaseConfig);
  const db = sdk.firestore();
  const warnPersistence = error => console.warn('Firestore persistent cache unavailable:', error.code || error.message);
  let persistenceReady = Promise.resolve();
  try {
    if (typeof db.enablePersistence === 'function') {
      persistenceReady = Promise.resolve(db.enablePersistence({ synchronizeTabs: true })).catch(warnPersistence);
    }
  } catch (error) { warnPersistence(error); }
  return { db, persistenceReady };
}

export { firebaseConfig };
