# LexicalSpace 43.19.0

Add vocabulary has three equal tabs: single word, six-digit code, AI library. The AI prompt and parser support one copyable text block. Both bulk workflows preview before saving and default to the keywords topic. Existing vocabulary progress and per-profile import receipts remain in the existing database.

Code generation, collision retries, and server-only lookup live in js/core/shared-decks.js. The import preview and library share action live in js/features/deck-sharing.js. Each share has an independent deck ID; valid codes can begin with zero. The server enforces a 72-hour window and prevents replacement of a live code. The old URL entry path has been removed.

AI text parsing and prompt generation live in js/core/ai-vocabulary.js. js/features/entry.js owns tab selection and topic assignment. The Windows TTL launcher and its prerequisites are documented in firestore/README.md. The live access rules were updated. TTL activation was refused because the project has billing disabled. The PWA build is local.
