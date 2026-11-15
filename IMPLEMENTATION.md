# LexicalSpace setup

Share a deck from **Library → Topic → Share Deck**. The app copies a link based on its current address. Use the hosted HTTPS address for links that other devices can open.

The complete Firestore rules for `home-page-d6c39` are in `firestore/firestore.rules`. These rules allow publishing and opening an individual deck by ID without Firebase sign-in. See `firestore/README.md` for publishing steps.

Practice & Progress stores daily new-word and review limits, auto-pronunciation, and sound effects for the current profile. Blank limits allow unlimited practice, and zero skips that category. Daily counts apply across practice modes and topics on this browser. An Again retry stays available after the daily limit is reached.

Quick Fill sends the target word to [Free Dictionary API](https://dictionaryapi.dev/), [MyMemory](https://mymemory.translated.net/doc/spec.php), and the [Datamuse API](https://www.datamuse.com/api/). If the dictionary lacks a usable example, [Tatoeba](https://api.tatoeba.org/) supplies an example and LexicalSpace generates a cloze. Source links appear on the answer face. Review the suggested fields before saving. Datamuse has announced that its keyless access will end February 1, 2027. If a lookup is unavailable, you can still fill in that field manually.

## v29 architecture reference

The app remains vanilla JavaScript with native ES modules. It requires no runtime npm packages or compilation. Serve it over localhost or HTTPS using the existing launcher. The original Firebase configuration is retained.

## Exact updates, file by file

| File | Change |
| --- | --- |
| `js/core/idb-manager.js` | IndexedDB v2; user/due and FIFO indexes; atomic word + outbox + review/session commits; revisions, monotonic timestamps, session conflict checks, migration, server reconciliation and acknowledgements. |
| `js/core/firebase-sync.js` | FIFO transactional cloud replay; discards superseded snapshots; compares revisions/timestamps/mutation IDs; revisioned deletion tombstones; retry-safe acknowledgements; incremental listener preserves active sessions and learning metadata. |
| `js/core/vocabulary.js` | Shared sense schema, non-destructive normalization, revision ordering, validation, stable sense matching, pipe/JSON import parsing. |
| `js/core/srs.js` | Pure SM-2-inspired scheduler, calendar-day graduation, due-first daily selection and shared new/review budgets. |
| `js/core/settings.js` | Per-user auto-pronounce and daily limits; defaults are 20 due reviews and 5 new words; at most 10 new words daily. |
| `js/core/pronunciation.js` | One speech/audio owner; immediate native speech; cancellation generations, abortable dictionary fallback and current-card gesture recovery. |
| `js/features/application.js` | Explicit application state and module wiring replace the accessor/global-function maze; safe initialization; account-scoped incremental refresh. |
| `js/features/auth.js` | Automatic outbox retries, reconnection handling, transactional legacy import, account lifecycle cleanup and session-preserving navigation. |
| `js/features/library.js` | All content changes, favorites, edits, deletes and merges use the outbox transaction. Context fields are visible; mastery cannot be granted with a library toggle. Content rendering uses safe data attributes/listeners. |
| `js/features/entry.js` | Validated `saveWord()` and `importVocabulary()`; context editor; duplicate/overwrite behavior; imports never replace SRS history with input fields. |
| `js/features/flashcard.js` | Reveal-before-grade, Again/Hard/Good/Easy, persisted miss retries, daily scope reservations, exact queue/reveal restoration, Previous, shortcuts, optional swipes and per-card auto-pronunciation. |
| `index.html` | Semantic recall card and controls, context fields, practice settings and visible sync status. Removed the blocking cinematic startup sequence. |
| `css/main.css` | Responsive recall/editor/settings styles and native hidden-answer protection. |
| `teacher/index.html` | Shared content validation, sense matching and transactional local outbox for imports/deletions; automatic retries; active-word counts exclude deletion tombstones. Corrected duplicated Firebase configuration mismatch. |
| `service-worker.js` | New cache version and precache list covering every new application module. |
| `package.json`, `package-lock.json`, `.gitignore` | Development-only test dependencies and reproducible test command. |
| `tests/core.test.js` | Transaction rollback, FIFO/revisions, conflicts, tombstones, migration, scheduler, content validation and audio race tests. |
| `tests/session.test.js` | Integrated DOM/IndexedDB tests for reveal, keyboard, misses, resumability, daily limits, editing/import and account separation. |

## Behavior and data contracts

### Transactional mutations

Call `commitVocabularyChanges()` in feature code, or `mutateWords()` at the storage boundary. Each mutation writes a complete record and an outbox snapshot in one native IndexedDB transaction. A durable sequence counter establishes FIFO order across tabs. Review grades also commit the advanced session and daily attempt count in that same transaction.

`revision` increases per word. `updatedAt` is an integer in milliseconds and increases even when the local clock goes backward. Concurrent equal-revision changes use `updatedAt`, then `mutationId`, as deterministic tie breakers. A newer remote revision wins; a queued stale revision cannot replace it. Earlier snapshots superseded locally are skipped in FIFO order. Deletions retain `deleted: true` records with revisions to prevent resurrection.

The cloud transaction updates the word and its count metadata together. Permanent permission failures remain queued and visible instead of being discarded. Automatic retries back off from 2 seconds to 60 seconds. User identity is still the existing username model; this change does not add Firebase Authentication or deploy Firestore security rules.

### Learning and sessions

- Space reveals. Keys 1/2/3/4 grade Again/Hard/Good/Easy. R replays pronunciation. Shortcuts ignore text fields and login/merge dialogs.
- New words begin at ease 2.5. Successful scheduled reviews start at 1 day, then 6 days (3 for Hard), then grow with ease. Ease never falls below 1.3. Again resets repetition and schedules a 10-minute relearning due time.
- One Easy grade or three Good grades since the most recent Again promote a word to Mastered. Hard leaves the Good count unchanged. Again resets that count and removes mastery. Mastery is separate from the spaced-repetition schedule.
- Again inserts a retry after three intervening cards when available; with fewer cards remaining, the retry is appended. A session cannot finish with unresolved misses.
- The default daily budget is 20 due reviews plus 5 new words. Reservations are shared across topic/mode scopes, so opening another scope cannot bypass the daily cap. Missed-card retries do not consume extra unique-word slots.
- Each scope saves its session ID, entry IDs, card queue, index, reveal/grade state, unresolved misses and session version. The most recently selected scope also survives a reload. Previous revisits already graded entries without recording duplicate grades; Continue returns to the next entry.
- Dates use the learner device's local calendar. At midnight, unfinished queues retain the exact card and unresolved misses, reserving their remaining words against the new day's budget. Completed sessions can start a new daily budget.

### Content

Word entries retain part of speech, sense, collocations, example and cloze sentences, plus the term, translation, synonyms and topic. Context fields can be left blank. Call `validateVocabulary(record, { requireContext: true })` to require contextual fields and 2–3 collocations.

Existing self-reported Known values are preserved as `selfReportedKnown`. Previously earned Mastered status and historical learning fields are retained. Older records only keep the most recent grade, so only a recorded last Good can seed the new Good counter.

Extended pipe format:

```text
Topic: Environment
resilient | kiên cường | robust, hardy | adj | B2 | able to recover after difficulty | highly resilient; resilient community | A resilient community can recover after a crisis.
```

JSON arrays are also accepted, using the schema's field names and an actual `collocations` array. Legacy `word | meaning | synonyms` lines still work. Import preview reports malformed lines instead of silently dropping them. Duplicate matching uses normalized term + POS + targeted sense/meaning. Overwrite changes content while preserving review history.

### Audio and browser limitations

Auto-pronounce defaults to true. Card mounting synchronously requests native speech instead of waiting for a dictionary fetch. All playback and pending requests are canceled when another word replaces the card, the user leaves practice, switches accounts, or hides the page.

Browsers may require a user gesture before the first audible playback. If a browser reports a blocked utterance, the controller retries only the current card on the next gesture. Available offline voices depend on the browser/OS. Dictionary audio is a fallback only when native speech is absent. The optional MyMemory fallback restoration was omitted after automatic approval review rejected that third-party transmission; no new translation destination was added.

## Upgrade and verification

1. Keep the original project backup. Close old LexicalSpace tabs before opening this version so IndexedDB can upgrade to v2.
2. Serve the updated folder using `start-localhost.bat`, or deploy the static files over HTTPS. Ship the updated service worker with all modules. Old clients must be upgraded together: they do not understand revisioned deletion records.
3. Existing local learning fields are normalized without deletion. Legacy unversioned queued operations are migrated conservatively; existing server content wins when historical revision ordering cannot be established. Unrecognized operations are retained and logged rather than silently deleted.
4. Check that deployed Firestore rules permit the existing student's word/metadata transaction. No live student database was changed during testing; cloud conflict tests use a transactional mock.
5. For development tests, use Node.js 22.22.2+, 24.15.0+, or 26+, run `npm ci`, then `npm test`. These packages are test-only and do not ship to the browser.

Validation completed: 22 automated tests passed; all application modules and the teacher module passed syntax checks. A cloud-disabled real-browser preview verified reveal/grade state, miss requeueing, settings and a 390 × 844 mobile viewport. The original live Firebase data was not used as test data.
