# Event Streaming & Job Persistence Design

## 1. Purpose

Introduce a real-time communication layer between the background runner and popup UI, while ensuring job state survives service-worker restarts. The design supports future integrations such as audit logging, reporting pipelines, and remote orchestration.

## 2. Current Baseline

- [`NotificationManager`](utils/notificationManager.js:1) persists a single-job snapshot in `chrome.storage.local` but lacks live event fan-out.
- [`setSnapshot()`](serviceWorker.js:154) serializes progress per stage, yet consumers only retrieve state through polling (`GET_JOB_STATUS` in [`serviceWorker.js`](serviceWorker.js:377) and [`chrome.runtime.sendMessage`](popup/src/App.tsx:657)).
- No persistent queue or activity log exists; the popup reconstructs state from a lone snapshot and verbose polling.

## 3. Goals

1. Deliver push-based updates (stage transitions, progress deltas, lifecycle status) to the popup without polling.
2. Maintain durable job metadata, activity entries, and queue details to enable resume-after-reload behavior.
3. Provide an extensible interface for new consumers (notifications, future options page, reporting exporters).

## 4. Architectural Components

### 4.1 Job Event Bus

- **Module**: `background/jobBus.js`
- **Responsibilities**: Publish structured events, manage subscriber registry, proxy commands from UI to runner.
- **Implementation**: Use `chrome.runtime Port` objects; when popup connects, register to bus and stream events via `port.postMessage`.
- **Fallback**: If ports disconnect, persist latest snapshot for polling-based retrieval.

### 4.2 Persistence Layer

- **Module**: `background/jobStore.js`
- **Storage Targets**:
  - `chrome.storage.local.jobSnapshot` for current job metadata.
  - `chrome.storage.local.jobActivity` as capped array (e.g., last 100 entries).
  - Optional `chrome.storage.local.jobQueue` to track pending jobs.
- **API**:
  ```ts
  interface JobStore {
    loadSnapshot(): Promise<JobSnapshot | null>;
    saveSnapshot(snapshot: JobSnapshot): Promise<void>;
    appendActivity(entry: JobActivity): Promise<void>;
    loadActivity(limit?: number): Promise<JobActivity[]>;
    clear(jobId: string): Promise<void>;
  }
  ```
- Ensure writes are debounced to avoid quota violations.

### 4.3 Runner Integration

- Runner publishes lifecycle events (`stageStarted`, `stageProgress`, `stageCompleted`, `jobPaused`, `jobResumed`, `jobCancelled`, `jobFailed`, `jobCompleted`).
- Each event updates snapshot via `jobStore.saveSnapshot()` and emits to bus subscribers.
- When service worker starts, runner hydrates from `jobStore.loadSnapshot()` and rebinds to the progress stage.

### 4.4 Popup Integration

- Replace polling in [`useEffect`](popup/src/App.tsx:652) with persistent `chrome.runtime.connect({ name: 'job-feed' })`.
- Popup listens for:
  - `JOB_SNAPSHOT`: full state for header.
  - `JOB_ACTIVITY`: incremental activity feed entries.
  - `JOB_QUEUE`: queue depth updates (future).
- Commands (`PAUSE_JOB`, `RESUME_JOB`, `CANCEL_JOB`) sent over the same port for minimal latency.

## 5. Data Contracts

### 5.1 Event Types

```ts
type JobEvent =
  | { type: 'stageStarted'; job: JobSnapshot; stage: StageId }
  | { type: 'stageProgress'; job: JobSnapshot; stage: StageId; processed: number; total?: number }
  | { type: 'stageCompleted'; job: JobSnapshot; stage: StageId }
  | { type: 'jobStatus'; job: JobSnapshot }
  | { type: 'jobActivity'; activity: JobActivity }
  | { type: 'jobQueue'; queue: JobQueueSummary };
```

### 5.2 Snapshot Structure

Reuse `JobSnapshot` fields defined in the background runner plan and surface new fields:

```ts
interface JobSnapshot {
  jobId: string;
  status: JobStatus;
  stage: StageId;
  stageIndex: number;
  stageUnits: { processed: number; total?: number };
  weightedPercent: number;
  indeterminate: boolean;
  activity: string;
  timestamp: string;
  summary?: JobSummary;
  error?: string;
}
```

### 5.3 Activity Entry

```ts
interface JobActivity {
  jobId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}
```

## 6. Command Handling

- Runner exposes `jobRunner.handleCommand(command: JobCommand)` with deduped semantics.
- `jobBus` routes messages from popup ports directly to `handleCommand`.
- Persist command history if required for auditing (optional for MVP).

## 7. Service Worker Lifecycle

1. On startup, load persisted snapshot/activity.
2. If snapshot indicates `status === 'running'`, mark job as `paused` with activity entry (since work halted unexpectedly).
3. Await explicit resume command to continue (prevents silent resume after crash).
4. Broadcast recovered snapshot to subscribers so UI can prompt operator.

## 8. Error Handling

- Store and broadcast structured errors. When `jobRunner` catches an exception, emit `jobActivity` with `level: 'error'`, set `snapshot.status = 'failed'`, and persist.
- The popup should inspect `snapshot.error` to render remediation tips.

## 9. Implementation Steps

1. **Shared Types**: Create `shared/jobTypes.ts` consumed by both background runner and popup.
2. **JobStore**: Implement persistence helpers with quota-aware writes and tests.
3. **JobBus**: Support `connect`, `disconnect`, `publish`, and fallback to snapshot retrieval.
4. **Runner Hooks**: Wire runner stage events to `jobBus` + `jobStore`.
5. **Popup Port**: Replace polling with port-based subscription; update state reducers to handle incremental events.
6. **Migration**: Clean up legacy `dedupeJob` storage keys once migration is stable.

## 10. Testing Strategy

- **Unit Tests**: Simulate runner events and assert snapshot persistence+bus emissions (`tests/jobBus.spec.ts`).
- **Integration Tests**: Mock popup port to verify streaming updates and command round-trips.
- **Manual Checklist**: Update [`tests/README.md`](tests/README.md:1) to include steps for pause/resume, reconnecting popup, and service worker restart recovery.

## 11. Future Extensions

- **Telemetry**: Forward events to analytics pipeline.
- **Remote Control**: Expose job commands via offscreen document or options page.
- **Reporting**: Use persisted summary and activity log to generate downloadable reports.
