# Testing Strategy Plan for Job Runner Redesign

## 1. Objectives

- Provide comprehensive automated and manual coverage for the stage-aware job runner, event streaming, popup UI, accessibility, localization, and reporting workflows.
- Ensure regression safety during refactor and future enhancements.
- Align testing artifacts with repository guidelines in [`tests/README.md`](tests/README.md:1).

## 2. Test Suite Overview

| Layer | Focus | Tools |
| --- | --- | --- |
| Unit Tests | Job runner state machine, job store persistence, export manager, i18n utilities | Jest + ts-jest |
| Integration Tests | Background service worker message flow, popup-job bus interaction | Jest with chrome API mocks |
| Component Tests | React components (ProgressHeader, StageList, ActivityFeed) | React Testing Library |
| End-to-End Tests | User flows covering start/pause/resume/cancel, reporting | Playwright or WebdriverIO (Headless Edge/Chromium) |
| Accessibility & Localization | Automated AXE/Lighthouse, manual SR testing | jest-axe, Chrome DevTools |
| Performance | Benchmark dedupe job runtime, job bus throughput | Custom script using `performance.now` |
| Manual Checklist | Validates real browser behavior, options page, undo windows | Updated `tests/README.md` |

## 3. Automated Testing Details

### 3.1 Job Runner Unit Tests (`tests/jobRunner.spec.ts`)
- Mock stage executors to simulate deterministic unit completion.
- Verify transitions: idle → running → paused → resumed → completed.
- Check weighted percent calculations and snapshot persistence.
- Validate cancel behavior ensures cleanup and abort signals propagate.

### 3.2 Job Store & Event Bus Tests (`tests/jobStore.spec.ts`, `tests/jobBus.spec.ts`)
- Use in-memory storage mocks to confirm snapshot/activity writes and quota handling.
- Assert event fan-out to multiple subscribers, including disconnection recovery.

### 3.3 Export Manager Tests (`tests/exportManager.spec.ts`)
- Generate sample summary/activity and verify CSV headers, values, redaction logic.
- Check JSON export schema matches expectations.

### 3.4 Localization Tests (`tests/i18n.spec.ts`)
- Ensure translation fallback when key missing.
- Validate pluralization and variable interpolation with sample languages.

### 3.5 React Component Tests
- `ProgressHeader.test.tsx`: simulate job snapshots for running/paused/failed, ensure buttons dispatch commands.
- `StageList.test.tsx`: confirm correct stage progress rendering and statuses.
- `ActivityFeed.test.tsx`: verify chronological order, severity icons, virtualization fallback.

### 3.6 End-to-End Tests (Playwright)
- Scenario 1: Start job → stage progression → completion; verify progress bars, metrics, exports.
- Scenario 2: Pause & resume mid-stage; ensure UI state updates.
- Scenario 3: Cancel job; confirm activity log and status message.
- Scenario 4: Error injection (mock network failure) and recovery guidance.
- Scenario 5: Localization scenario launching popup with alternate locale.

### 3.7 Accessibility Testing
- Integrate `jest-axe` to evaluate key React components for accessibility violations.
- Run Lighthouse CI against popup build for WCAG baseline.
- Script Playwright to enforce focus trapping and keyboard navigation.

### 3.8 Performance Tests
- Add benchmark script (`tests/perf/jobRunner.bench.mjs`) to measure stage throughput, ensuring ~100 bookmarks under target runtime.
- Capture metrics before and after regression.

## 4. Manual Testing Checklist (Update [`tests/README.md`](tests/README.md:1))
- Launch Edge extension, run job end-to-end verifying UI surfaces.
- Screen reader pass with Narrator/JAWS highlighting stage announcements.
- Offline scenario: disconnect network mid-run, ensure pause/resume behavior.
- Localization check by switching to non-English locale.
- Export downloads (CSV/JSON), verifying redaction toggles and file contents.
- Undo operation within allowed window.
- Service worker restart recovery test (Inspect -> Stop -> resume job).

## 5. Tooling & Configuration

- Add `jest.setup.ts` to configure React Testing Library and jest-axe.
- Extend `tsconfig.json` paths for shared job types.
- Configure Playwright project in `tests/e2e/playwright.config.ts`.
- Continuous Integration: update pipeline to run unit + component + e2e tests on push.

## 6. Implementation Steps

1. Set up jest environment for background and popup contexts.
2. Author unit tests for job runner, job store, export manager.
3. Create React component tests for new UI.
4. Integrate jest-axe and add accessibility snapshots.
5. Configure Playwright, script main job lifecycle scenarios.
6. Update `tests/README.md` with expanded manual checklist.
7. Document test commands in `README.md` and `BUILD_SUMMARY.md`.

## 7. Reporting & Maintenance

- Collect test artifacts (Playwright videos, coverage reports) and store under `tests/artifacts/`.
- Add coverage badge or stats to documentation.
- Review tests quarterly to align with evolving features (reporting, remote orchestration).
- Encourage contributors to run `npm test` in `popup/` and root-level jest suites before PR submission.
