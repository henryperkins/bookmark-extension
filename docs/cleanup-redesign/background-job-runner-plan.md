# Background Job Runner Implementation Plan

## 1. Objectives and Scope

- Introduce a reusable job runner that tracks stage-based progress, exposes pause/resume/cancel, and persists lifecycle metadata across popup sessions.
- Decouple the current monolithic flow in [`serviceWorker.js`](serviceWorker.js:108) so each stage reports deterministic units of work and can be scheduled, paused, or resumed.
- Provide a single source of truth for job state that can drive notifications, popup UI, and future telemetry/reporting surfaces.

## 2. Core Concepts

### 2.1 Job Definition

| Field | Description |
| --- | --- |
| `jobId` | Stable UUID for the dedupe run. Generated when a job is queued. |
| `status` | `idle`, `queued`, `running`, `paused`, `cancelling`, `cancelled`, `failed`, `completed`. |
| `stage` | Stage identifier (`initializing`, `scanning`, `grouping`, `resolving`, `verifying`, `summarizing`). |
| `stageIndex` | Index inside ordered stage array for progress sorting. |
| `stageUnits` | `{ total: number, processed: number }` used to calculate stage percent. |
| `weightedPercent` | Cumulative progress based on configurable stage weights. |
| `activityLog` | Array of timestamped messages for activity feed. |
| `summary` | Completion payload (counts, conflicts, exported file handles, etc.). |
| `queueMeta` | `{ requestedBy, requestedAt, schedule }` for audit/reporting. |

### 2.2 Stage Weight Map

- Persist default weights in a configuration module (e.g. `lib/jobConfig.ts`) consumed by both runner and popup.
- Allow overrides through sync storage to support future tuning.
- Example weights: `initializing 5%`, `scanning 30%`, `grouping 10%`, `resolving 40%`, `verifying 10%`, `summarizing 5%`.

### 2.3 Commands

| Command | Origin | Effect |
| --- | --- | --- |
| `START_JOB` | Alarm or popup | Create job, enqueue for execution if idle. |
| `PAUSE_JOB` | Popup | Set runner state to `paused`, persist stage units, stop timers. |
| `RESUME_JOB` | Popup | Switch back to `running`, rehydrate workers, continue from saved units. |
| `CANCEL_JOB` | Popup | Transition to `cancelling`, unwind in-flight work, flush queue, emit `cancelled`. |
| `GET_JOB_STATUS` | Popup | Return snapshot + recent activity. |
| `GET_ACTIVITY_LOG` | Popup | Paginate activity log for feed rendering. |

## 3. Architecture Changes

### 3.1 Module Layout

- Create `background/jobRunner.js` for lifecycle orchestration and stage state machine.
- Extract stage implementations to `background/stages/` so each exports `prepare()`, `execute(context)`, `teardown()` and can report deterministic units.
- Update [`serviceWorker.js`](serviceWorker.js:107) to delegate to the runner instead of orchestrating inline.
- Enhance [`utils/notificationManager.js`](utils/notificationManager.js:1) to listen for runner events instead of being called manually.
- Add `background/jobBus.js` (light message emitter) to fan out events to popup and notifications.

### 3.2 State Persistence

- Store authoritative snapshot in `chrome.storage.local` under `jobSnapshot`.
- Maintain lightweight queue metadata in memory; persist backlog for crash recovery.
- Serialize `activityLog` ring buffer (e.g. last 50 entries) to `chrome.storage.local` to support feed replay.

### 3.3 Event Emission

- Emit structured events for `stageStarted`, `stageProgress`, `stageComplete`, `jobPaused`, `jobResumed`, `jobCancelled`, `jobFailed`, `jobCompleted`.
- Provide a `subscribe` API for popup ports to receive live updates without polling.
- Fallback to storage-based polling when the popup subscribes late or ports disconnect.

## 4. Pause / Resume / Cancel Mechanics

1. **Pause**  
   - Set `status` to `paused`, persist snapshot, clear timers/rate-limited loops.  
   - Stage implementations should check runner state between batches and exit early when paused.

2. **Resume**  
   - Restore stage context (e.g. current bookmark index, queue pointers) from persisted snapshot.  
   - Restart stage execution loops with deduped input to avoid re-processing completed units.

3. **Cancel**  
   - Mark `status` `cancelling`.  
   - Signal stage executors to abort gracefully via shared `AbortController`.  
   - Flush temporary artifacts (e.g. pending API calls, offscreen docs).  
   - Transition to `cancelled`, append activity entry, clear notifications, zero-out progress bars.

## 5. Integration with Existing Flows

### 5.1 Deduplication (Embeddings)

- Update [`embeddings.js`](embeddings.js:51) to report progress through runner-provided callbacks rather than talking directly to `NotificationManager`.
- Ensure on-progress callbacks accept pause/cancel check to yield control quickly.

### 5.2 Tagging and Folder Suggestions

- Wrap `tagNodes` and `suggestFolders` loops in stage executor abstractions so they respect pause/cancel and report units consumed.

### 5.3 syncManager Verification

- Treat conflict resolution as its own stage with deterministic units (number of bookmarks evaluated).

### 5.4 Review Queue / Preview Mode

- Store job summary and activity log entries containing review queue counts so the popup can display results even after the worker resets.

## 6. Popup UI Contract

- Replace polling in [`popup/src/App.tsx`](popup/src/App.tsx:653) with long-lived `chrome.runtime.connect`.
- Introduce dedicated progress header component consuming runner events; include pause/resume/cancel buttons controlling job commands.
- Add activity feed panel reading from `activityLog` snapshot plus push events.
- Provide accessibility announcements using `aria-live` region and support reduced motion on progress transitions.

## 7. Data Flow Diagram

```
Alarm / Popup → jobRunner.enqueue()
jobRunner → stage executor loop → emit stage progress
jobRunner → jobBus → NotificationManager & popup port
popup → jobBus command listener → jobRunner control
jobRunner → chrome.storage.local jobSnapshot/activityLog
```

## 8. Implementation Steps

1. **Foundation**
   - Scaffold `jobRunner` module with state machine, storage adapters, event bus.
   - Define TypeScript-friendly interfaces shared between background and popup (e.g. `types/job.ts` published via `shared/` folder).

2. **Stage Refactor**
   - Extract current inline logic in [`serviceWorker.js`](serviceWorker.js:180) into discrete stage modules.
   - Ensure each stage reports units and respects abort signals.

3. **Command Surface**
   - Update message router in [`serviceWorker.js`](serviceWorker.js:300) to handle `PAUSE_JOB`, `RESUME_JOB`, `CANCEL_JOB`, `CONNECT_PORT`.
   - Implement reconnect logic for popup ports and fallback polling.

4. **Notification Updates**
   - Rework [`NotificationManager`](utils/notificationManager.js:1) to listen to runner events and show stage-aware toasts plus completion/failure details.

5. **UI Enhancements**
   - Build progress header, controls, and activity feed components in `popup/src/components/`.
   - Integrate with runner events, add accessibility hooks, and align styling with design spec.

6. **Persistence & Recovery**
   - Implement snapshot hydration on service worker startup to resume interrupted jobs.
   - Add migration helper to clear legacy `dedupeJob` snapshots after rollout.

7. **Testing**
   - Unit-test runner state transitions and stage progress calculations (`tests/jobRunner.spec.ts`).
  - Add integration tests for pause/resume/cancel flows using mocked chrome APIs.
  - Update manual checklist in [`tests/README.md`](tests/README.md:1) to include new scenarios.

## 9. Risk Mitigation

- Guard against storage quota spikes by trimming `activityLog`.
- Ensure all stage executors check `AbortController` signals to avoid ghost work after cancellation.
- Validate error handling for network/API failures and emit actionable activity entries.

## 10. Next Steps

- Capture API shape for future server-driven job orchestration to keep background runner compatible with remote scheduling.
- Plan telemetry/reporting once stage-aware runner is stable (export summaries, CSV reports, audit trails).
