# Shared vocabulary codes

LexicalSpace publishes a vocabulary snapshot at `shared_decks/{sixDigits}` in the default database of `home-page-d6c39`. A code can start with zero. Firestore rules use server time to allow single-document reads for 72 hours after issuance. Rules reject overwriting an active code. The app retries a collision with a different code. An independent deck ID keeps import receipts distinct when an expired code is reused.

`firestore.rules` contains the complete rules. `shared-decks.match.rules` contains the matching excerpt. Clients cannot list or delete decks. A code grants access to its vocabulary, so shared snapshots should contain only material intended for students.

## Automatic cleanup

Run `tools/Enable-Deck-TTL.cmd` on Windows with the Firebase CLI signed in to the project. The launcher requests a TTL policy for `shared_decks.expiresAt`. This requires billing and appropriate Firestore administration permissions. It does not enable billing. Expired codes are rejected by the access rules even while cleanup is pending. A delayed cleanup does not affect words already imported into student libraries.

[Firestore TTL documentation](https://firebase.google.com/docs/firestore/ttl)
