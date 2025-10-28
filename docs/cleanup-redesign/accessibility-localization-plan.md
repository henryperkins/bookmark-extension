# Accessibility, Localization, and Error-Handling Plan

## 1. Objectives

- Achieve WCAG 2.2 AA compliance across popup UI, service worker notifications, and options screens.
- Introduce localization scaffolding to support multiple languages and culture-aware formatting.
- Implement consistent error-state handling with recovery guidance, privacy controls, and offline resilience.

## 2. Accessibility Enhancements

### 2.1 Semantic Structure & Landmarks
- Ensure popup layout uses semantic tags (`header`, `nav`, `main`, `section`) where possible.
- Provide `aria-labelledby` and `aria-describedby` relationships for all interactive controls.
- Add `role="status"` / `aria-live` regions for dynamic updates (progress, activity feed, completion summaries).

### 2.2 Keyboard Navigation
- Enforce logical tab order across new components (ProgressHeader, StageList, ActivityFeed).
- Add roving tabindex for activity feed items to allow arrow key navigation.
- Implement `Escape` key handling to close modals (e.g., ReportModal).

### 2.3 Focus Management
- When dialog windows open (pause confirmation, cancel warning, report modal), trap focus and return it to the triggering element on close.
- On stage transitions, avoid automatic focus shifts unless essential; instead log updates in live regions.

### 2.4 Reduced Motion & Animations
- Respect `prefers-reduced-motion`; disable progress bar animation transitions and provide instant updates.
- Provide alternative text to describe progress when motion is disabled.

### 2.5 Contrast & Typography
- Validate color contrast for progress bars, status badges, and activity severity icons.
- Maintain minimum 14px semibold text for labels, as set in [`App.tsx`](popup/src/App.tsx:672).

### 2.6 Screen Reader Announcements
- Announce:
  - Job start: “Cleanup started. Stage: Initializing.”
  - Stage changes: “Stage complete. Next stage: Resolving.”
  - Completion or failure summaries with actionable follow-up instructions.
- NotificationManager to surface descriptive messages via `chrome.notifications` with `contextMessage`.

### 2.7 Error & Confirmation Dialogs
- Provide accessible alerts using `role="alertdialog"` for cancel confirmations and failure explanations.
- Ensure dialogs remain accessible offline (no remote assets).

## 3. Localization Strategy

### 3.1 Translation Infrastructure
- Create `popup/src/i18n/` with JSON catalogs (`en.json` default).
- Build `useI18n()` hook returning `t(key, params)`.
- Configure compile-time detection to load locale determined by `chrome.i18n.getUILanguage()` with fallback to English.

### 3.2 String Extraction
- Replace hard-coded English strings in popup components, background notifications, and options UI with translation keys.
- Provide structured keys: `status.initializing`, `activity.duplicateFound`, `button.pause`.

### 3.3 Formatting Helpers
- Introduce utilities for numbers (percentages, counts) and dates using `Intl.NumberFormat` and `Intl.DateTimeFormat`.
- Ensure relative time (e.g., “2 minutes ago”) respects locale by leveraging `Intl.RelativeTimeFormat`.

### 3.4 Pluralization & Gender
- Use interpolation helpers to handle plural forms (e.g., duplicates count).
- Plan for future grammatical gender support by supporting nested keys.

### 3.5 Localization Testing
- Add manual test checklist to [`tests/README.md`](tests/README.md:1) to verify:
  - UI after switching `chrome://settings/languages` to French/Spanish.
  - No truncated strings or overlapping controls with longer translations.

## 4. Error-Handling Framework

### 4.1 Error Taxonomy
- Define error codes: `NETWORK`, `AUTH`, `QUOTA`, `STORAGE`, `RATE_LIMIT`, `UNEXPECTED`.
- Map to user-friendly messages via translation catalog.

### 4.2 Background Error Flow
- Job runner catches exceptions, logs via `jobActivity` with severity, persists to snapshot.
- When recoverable, surface “Retry” or “Resume” actions; for non-recoverable, instruct user to inspect logs or adjust settings.
- NotificationManager uses stage-aware messages, e.g., “Tagging halted due to network timeout. Job paused.”

### 4.3 Popup Error Surfaces
- Display inline banner in `ProgressHeader` when `snapshot.status === 'failed'`.
- Activity feed highlights severe entries with red accent and `role="alert"`.
- Provide “Report issue” link (maybe to GitHub) from error detail modal.

### 4.4 Offline & Sync Failures
- Detect offline state via `navigator.onLine`; toggle UI with offline banner and disable new job actions.
- When sync conflicts appear, add action to open `edge://favorites` and provide instructions.

### 4.5 Undo & Recovery
- For destructive actions (auto-apply), store last operation summary in `chrome.storage.local.recoverableJob`. Offer `Undo` button for `n` seconds via NotificationManager.
- Implement retry/backoff for API calls with exponential delay.

### 4.6 Privacy & Redaction
- Mask URLs and titles in logs or notifications when “privacy mode” toggled in options.
- Provide toggle to disable sharing activity logs with upcoming reporting pipeline.

## 5. Documentation & QA

### 5.1 Documentation
- Update [`README.md`](README.md:1) with accessibility and localization notes.
- Create `docs/accessibility-testing-checklist.md` covering screen reader, keyboard, reduced motion, localization.

### 5.2 QA Checklist
- Manual tests:
  - NVDA/JAWS voiceover for progress updates.
  - Keyboard-only job lifecycle control.
  - Offline scenario (disconnect network) while job running.
  - Localization switch verifying string replacements.
- Automated tests:
  - Jest unit tests verifying translation fallback.
  - React Testing Library tests for focus traps and live region updates.
  - End-to-end smoke test (Playwright) covering job failure/resume.

### 5.3 Release Gate
- Accessibility audit performed before release, capturing DevTools Lighthouse report.
- Localized screenshots for at least one non-English language to confirm layout.

## 6. Implementation Steps

1. Introduce translation infrastructure and refactor existing strings.
2. Implement `JobContext` and UI components with accessibility attributes.
3. Enhance NotificationManager to emit structured errors and undo window.
4. Add offline detection and error taxonomy mapping.
5. Update manual and automated test suites.
6. Document new settings and controls.

## 7. Future Considerations

- Provide localization fallback to load partial translations from remote A/B tests.
- Integrate telemetry to track accessibility warnings (e.g., missing translation keys).
- Expand undo buffer to cover bulk bookmark edits beyond dedupe job.
