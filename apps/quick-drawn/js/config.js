const LEXICALSPACE_CONFIG = {
      projectId: "home-page-d6c39", // Reserved metadata; vocabulary remains IndexedDB-only.
      dbName: "LexicalSpaceDB",
      wordsStore: "words",
      usernameStorageKey: "vocab_user",
      fallbackUsernameKeys: [
        "vocab_user",
        "username",
        "lexicalSpace_username",
        "lexicalspace_username",
        "currentUser",
        "studentUsername",
        "user"
      ],
      wordsCollection: "words"
    };

    const LOCAL_KEYS = {
      BEST_SCORE_PREFIX: "quickDrawn_bestScore_"
    };

// Existing Homepage Web App configuration; vocabulary still uses IndexedDB read-only.
const QUICKDRAWN_FIREBASE_CONFIG = {
  "apiKey": "AIzaSyCAejXQfHKQ0ZKTpR7kphaDFCGqCcuoRfI",
  "authDomain": "home-page-d6c39.firebaseapp.com",
  "projectId": "home-page-d6c39",
  "storageBucket": "home-page-d6c39.firebasestorage.app",
  "messagingSenderId": "916831594708",
  "appId": "1:916831594708:web:64d97a5a3b8872f7173341"
};
