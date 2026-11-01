const firebaseConfig = {
      apiKey: "AIzaSyCAejXQfHKQ0ZKTpR7kphaDFCGqCcuoRfI",
      authDomain: "home-page-d6c39.firebaseapp.com",
      projectId: "home-page-d6c39",
      storageBucket: "home-page-d6c39.firebasestorage.app",
      messagingSenderId: "916831594708",
      appId: "1:916831594708:web:64d97a5a3b8872f7173341"
    };

    let db = null;
    try {
      if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
      }
    } catch (err) {
      console.warn("Firebase Init Offline Warning:", err);
    }


// Persist the Firestore query cache where the browser supports it.
const firebasePersistenceReady = db && typeof db.enablePersistence === 'function'
  ? db.enablePersistence({ synchronizeTabs: true }).catch(error => {
      console.warn('Firestore persistent cache unavailable:', error.code || error.message);
    })
  : Promise.resolve();
export { firebaseConfig, db, firebasePersistenceReady };
