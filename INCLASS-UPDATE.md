# In-Class Check — 43.2.0 miniupdate

Updated: 16/11/2026 (Asia/Saigon). Local source update; no commit, push or deployment performed for this change.

## Active implementation

This project uses `index.html` + `js/features/in-class-check.js`; there is no active `offline.html`.

Functions changed in `js/features/in-class-check.js`:

- `selectInClassPool(words, now, random, checkedIds)`: keeps green/blue eligibility and the existing 72-hour pool/fallback. Deduplicates string IDs, partitions that pool by history, shuffles with Fisher–Yates, selects at most 15, and returns the history rollover flag. Fills a short unseen pool with seen cards, without duplicates in a check.
- `currentPool(history)`: applies the current profile filter and passes its history to selection.
- `renderIntro()`: describes the 15-word check and unchecked-first selection.
- `renderResults()`: shows every submitted answer, Correct/Incorrect badges, two comparison columns, target/meaning and a pronunciation button. `escapeHtml()` protects the raw typed text, target, meaning and audio label. CSS preserves typed whitespace and wraps long strings.
- `resetInClassCheck()`: clears answer comparisons and history-save feedback, and invalidates a pending start when changing profile.
- `setupInClassCheck()`: wires asynchronous starts, raw-answer submission, completion-only history saves, save retries and delegated result-audio clicks. Blank submissions count as incorrect and display `(Empty)`; the existing target-or-synonym matching remains unchanged.

New private helpers:

- `historyKey()` uses the existing `getStudentKey()` to create `inclassCheckedIds_<studentKey>`.
- `uniqueIds()` validates/deduplicates history arrays; `shuffled()` is a non-mutating Fisher–Yates shuffle.
- `startCheck()` performs one metadata read after Start, with a duplicate-click guard and profile/navigation checks. It does not save history.
- `saveCompletedHistory()` performs one local metadata read/write transaction after the final answer. The record is `{key, value: [word.id, ...]}` in the existing `metadata` store. It appends IDs during a cycle, or replaces history with the selected batch at rollover. If another tab updated history meanwhile, its latest IDs are retained instead of being overwritten. A failed save leaves results visible and offers Retry.

An unfinished/abandoned check never changes history. For small pools or the end of a cycle, repeated words across checks can be necessary to fill 15 slots; there are never duplicate IDs inside one check. The 72-hour priority pool is preserved, so older cards become candidates when that recent pool is empty, as before.

## Other changed files

- `index.html`: answer-review list, save-feedback/retry controls, optional blank answer submission, updated guide, version/date footer.
- `css/recall-ui.css`: two-column comparison and readable pastel rose/emerald colors matching the current light theme. Correct answers have green styling and an explicit badge.
- `tests/in-class-check.test.js`: selection/history, aborted checks, profile isolation, literal/XSS-safe answers, empty answers, result audio, rollover, failed-save retry, concurrent history updates and unchanged SRS/outbox.
- `package.json`, `package-lock.json`, `AGENTS.md`: version 43.2.0 and release metadata.
- `service-worker.js`: refreshed cache fingerprint; existing lifecycle and fetch logic retained.

## Preservation and validation

- No IndexedDB schema/version migration, new store, localStorage-key change, Firebase write, security-rule change, or cloud history sync.
- Flashcard learning, SRS/review, Quick Fill/import, topic merge/delete, Firebase sync and storage modules are unchanged.
- Full automated suite: 125 passing tests, including existing flashcard, import and topic-operation tests. The updated history/concurrent-save tests also pass separately.
- Real local Chromium run: correct/incorrect answers render side by side; a submitted `<img ... onerror=...>` remains literal text. At 390px, both columns share a row and there is no horizontal overflow. This is desktop browser responsive testing, not an Android device test.
- Only isolated Guest/test fixtures were used; no real student database was edited for testing.
