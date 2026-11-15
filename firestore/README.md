# Shared deck deployment

`firestore.rules` is the complete replacement for the rules supplied for Firebase project `home-page-d6c39`. It preserves the legacy access for the rest of the app and excludes the entire `shared_decks` tree from the broad rule.

1. Save a copy of the rules currently published for the default database. In the Firebase Console Rules editor, replace the entire ruleset with `firestore.rules` and select **Publish**.
2. Open LexicalSpace and share a sample topic. Open the copied link in a separate browser profile and import it into a local library.

Anyone can create a deck with a valid document ID and top-level structure. Anyone with a link can read that one deck. Listing, updating and deleting decks are denied to app clients. The app validates every vocabulary card before publishing and after fetching. The rules validate the top-level fields only, so public creation also allows writes from clients other than LexicalSpace.

- [Firestore rules matching and overlaps](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Firestore field validation](https://firebase.google.com/docs/firestore/security/rules-fields)
- [Firestore rules emulator](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
