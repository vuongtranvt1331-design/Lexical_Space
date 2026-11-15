# LexicalSpace release conventions

These instructions apply to this LexicalSpace project.

- After every code update, refresh the last-updated date in the side-menu footer in index.html to the actual release/edit date, using Asia/Saigon time.
- Use X.Y.z versions. Changes without a side-menu redesign are miniupdates: increment Y and reset z to 0.
- For a release that changes the side menu and adds features, increment X and reset Y and z to 0.
- Bug-fix-only releases increment z and show the word hotfix alongside the version in the footer/release notes. Keep package.json/package-lock.json versions numeric X.Y.z.
- Keep the footer version, build/file reference, package version and lockfile root version consistent. Refresh service-worker cache VERSION/CORE when app-shell assets change.
- Current release: 43.1.0, miniupdate for PWA installation support, dated 2026-11-15.
- Never clear user storage, unregister the service worker, or purge all origin caches as an update step.
- Commit/push only when the user requests it.
