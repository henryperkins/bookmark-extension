# Popup UI Progress & Activity Plan

## 1. Objectives

- Replace the current single-line header in [`App.tsx`](popup/src/App.tsx:648) with a comprehensive status surface that reflects stage-aware progress, pause/resume/cancel controls, and job summaries.
- Introduce an activity feed, metrics panel, and downloadable reports scaffold aligned with the redesign requirements.
- Ensure compliance with accessibility (WCAG 2.2 AA), localization readiness, and reduced-motion preferences.

## 2. Component Breakdown

| Component | Responsibility | Notes |
| --- | --- | --- |
| `ProgressHeader` | Displays primary status, stage name, weighted percent, estimated time remaining, and control buttons | New file `popup/src/components/ProgressHeader.tsx`; consumes `JobSnapshot` via context |
| `StageList` | Shows ordered stages with individual completion bars and statuses | New file `popup/src/components/StageList.tsx`; stage metadata pulled from shared config |
| `ActivityFeed` | Streams recent `JobActivity` events with filters and timestamps | New file `popup/src/components/ActivityFeed.tsx`; supports virtualized list |
| `ActionToolbar` | Hosts `Start`, `Pause`, `Resume`, `Cancel`, and `Download Report` actions | Embedded in `ProgressHeader` or separate `ControlsBar` |
| `MetricsPanel` | Summarizes totals, duplicates found, conflicts resolved, and processing rate | New file `popup/src/components/MetricsPanel.tsx`; rendered on completion and during running |
| `ReportModal` | Guides the user through CSV/JSON export and audit log download | Lazy-loaded component activated by toolbar |

All components consume `JobContext` provided at the App shell to avoid prop drilling.

## 3. State Management & Data Flow

1. [`App.tsx`](popup/src/App.tsx:652) establishes a `JobProvider` that subscribes to the background job bus via `chrome.runtime.connect`.
2. The provider exposes:
   ```ts
   interface JobUIState {
     snapshot: JobSnapshot | null;
     activity: JobActivity[];
     queue: JobQueueSummary | null;
     dispatch(command: JobCommand): void;
   }
   ```
3. Child components leverage hooks (`useJob()` and `useActivityFeed()`) to render real-time data.
4. Fallback polling remains for legacy browsers by scheduling a 10s interval only when the port disconnects.

## 4. Layout Changes

- Introduce a top-level layout skeleton in `App.tsx`:
  ```
  ┌───────────────────────────┐
  │ ProgressHeader            │
  ├───────────────────────────┤
  │ StageList  │ MetricsPanel │  // responsive grid
  ├───────────────────────────┤
  │ ActivityFeed              │
  ├───────────────────────────┤
  │ Existing tab navigation   │
  └───────────────────────────┘
  ```
- Use CSS variables for sizing, respecting Windows 11 typography defined in `[styles](popup/src/App.tsx:3)`.
- Ensure responsive collapsible panels for narrow popup width (<= 360px).

## 5. Accessibility

- `ProgressHeader`:
  - `aria-live="polite"` for status text.
  - `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`.
  - Provide tooltip content for controls with `aria-describedby`.
- `StageList`:
  - Each stage row exposes `role="listitem"` with textual summary for screen readers.
  - Use `prefers-reduced-motion` media query to disable animated transitions.
- `ActivityFeed`:
  - Provide keyboard navigation (tab + arrow keys) and `aria-label` for timestamp formatting.
- Localization:
  - Move strings into `popup/src/i18n/en.json` (new) and load via simple translation hook (`useI18n()`).
  - Provide keys for all button labels, activity messages, and metric captions.

## 6. Visual Design

- Progress bar colors follow existing palette:
  - Primary progress: `styles.colors.primary`.
  - Warning states: `styles.colors.danger`.
  - Completed stages: `styles.colors.success`.
- Buttons adopt segmented control styling for `Pause/Resume/Cancel`.
- Activity feed items display iconography (info/warning/error) with accessible color contrast.

## 7. Interaction Flows

1. **Start Job**  
   - `ActionToolbar` sends `START_JOB`; header switches to `running`, progress resets to 0%.
2. **Pause/Resume**  
   - When `snapshot.status === 'running'`, show `Pause`; on `paused`, replace with `Resume`.
3. **Cancel**  
   - Confirm modal before sending `CANCEL_JOB`. On cancel success, activity feed logs event, controls disable until new job.
4. **Completion**  
   - Metrics panel surfaces duplicates found, conflicts resolved, time elapsed.
   - `ReportModal` becomes enabled for download.

## 8. Error & Offline States

- Header displays inline alert banner when `snapshot.status === 'failed'` or `error` present.
- Activity feed shows high-priority entries for errors.
- When offline (caught via `navigator.onLine === false`), controls disable and a tooltip instructs reconnection.

## 9. Integration Steps

1. Scaffold `JobContext` and provider in `popup/src/context/JobContext.tsx`.
2. Refactor `App.tsx` to wrap tabs with provider and render new components.
3. Implement `ProgressHeader`, `StageList`, `ActivityFeed`, `MetricsPanel`, `ActionToolbar`, `ReportModal`.
4. Introduce `popup/src/hooks/useJob.ts`, `popup/src/hooks/useActivityFeed.ts`, `popup/src/hooks/useI18n.ts`.
5. Build translation scaffolding (`popup/src/i18n/en.json`, `popup/src/i18n/index.ts`).
6. Update existing tabs to consume job context where necessary (e.g., `ReviewQueue` for duplicates count).
7. Add unit tests using React Testing Library for progress header interactions and feed rendering.

## 10. Dependencies

- Consider adding lightweight utils (e.g., `date-fns` for relative timestamps) or craft manual formatter.
- Evaluate virtualization (e.g., `react-window`) if activity feed grows, but keep optional for MVP.
- Extend `tsconfig` paths if introducing shared types.

## 11. Testing & QA

- Automated:
  - Snapshot tests for progress header states (`running`, `paused`, `completed`, `failed`).
  - Interaction tests verifying `Pause/Resume/Cancel` dispatch correct commands.
  - Activity feed rendering test with new events.
- Manual:
  - Screen reader walkthrough confirming announcements.
  - Reduced motion verification using browser dev tools.
  - Localization smoke test switching languages (even if only English initially, ensure fallback logic).
  - Offline mode simulation.

## 12. Deliverables

- Updated popup layout with new components, job context, and translation scaffolding.
- Documentation updates in [`BUILD_SUMMARY.md`](BUILD_SUMMARY.md:1) and `README` describing UI controls and status surfaces.
- Recorded Edge DevTools screenshots for QA.
