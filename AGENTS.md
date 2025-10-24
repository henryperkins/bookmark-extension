# Repository Guidelines

## Project Structure & Module Organization
The root hosts the MV3 service worker stack: `serviceWorker.js` coordinates cleanup, while `embeddings.js`, `tagger.js`, `writer.js`, and `bookmarksCrud.js` sit beside import and export helpers. Shared plumbing lives in `utils/` (rate limiter, storage and notification managers, folder suggestions, sync helpers) and compute-heavy helpers such as `cosine.js` are collected in `lib/`. UI resources are split between the React popup in `popup/src/`, the options page in `options/`, and static assets in `icons/`. Generated bundles belong in `build/` (for example `build/popup/`). Manual and automation guidance is tracked in `tests/`.

## Build, Test, and Development Commands
- `cd popup && npm install` installs the React and Vite toolchain.
- `cd popup && npm run dev` serves the popup with hot reload.
- `cd popup && npm run build` runs TypeScript checks and emits production assets to `../build/popup/`.
- Open `edge://extensions`, pick **Service Worker**, then **Inspect** to live debug the background logic while iterating.

## Coding Style & Naming Conventions
Use modern ES modules with two space indentation and trailing commas in multiline literals. Prefer `const` or `let` over `var`, camelCase for functions and variables, and PascalCase for exported factories such as `StorageManager`. React components in `popup/src/` should stay as typed function components with hooks near their usage. Choose descriptive filenames (`duplicateDetector.js`, `ReviewQueue.tsx`) and add brief comments only when a control flow or async sequence would otherwise be hard to follow.

## Testing Guidelines
Work through the checklist in `tests/README.md` before opening a pull request; cover configuration, deduplication accuracy, CRUD paths, and the expectation that roughly 100 bookmarks process in under one minute. To add automated coverage, colocate Jest specs under `tests/`, mirror the provided cosine and tag validator examples, and run them with `npm test` after installing local dev dependencies. Capture Edge DevTools screenshots whenever you address UI regressions or race conditions.

## Commit & Pull Request Guidelines
Adopt Conventional Commits so the existing `CHANGELOG.md` sections stay traceable (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Each pull request should summarize the intent, link any issue or roadmap item, include manual test notes or Jest output, and attach screenshots or GIFs for UI changes. Update `README.md`, `QUICK_START.md`, or `BUILD_SUMMARY.md` when behavior shifts, and queue `[Unreleased]` entries in `CHANGELOG.md` as part of the same branch.

## Security & Configuration Tips
Never commit Azure OpenAI keys; store them through the Options UI or a local `.env` that remains ignored. If you add new network targets, restrict host permissions in `manifest.json` and explain any optional scopes. Confirm device-only mode remains opt in when touching storage logic, and retest both sync and local storage paths before you ship.
