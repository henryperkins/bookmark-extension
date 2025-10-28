# Reporting & Export Workflow Plan

## 1. Objectives

- Provide structured reporting outputs aligned with the redesign: summary dashboards, downloadable CSV/JSON payloads, and optional audit logs.
- Support both real-time inspection via popup UI and post-run exports consumable by stakeholders.
- Ensure privacy-aware data handling with configurable redaction.

## 2. Reporting Artifacts

| Artifact | Location | Format | Purpose |
| --- | --- | --- | --- |
| Job Summary Snapshot | `chrome.storage.local.jobSnapshot.summary` | JSON | High-level counts (processed, duplicates, conflicts, runtime) used by metrics panel |
| Activity Log | `chrome.storage.local.jobActivity` | JSON array | Detailed timeline for activity feed and audit |
| CSV Export | Generated on-demand | CSV | Human-readable duplicates list, actions taken, conflicts resolved |
| JSON Export | Generated on-demand | JSON | Machine-friendly payload for downstream automation |
| Audit Log Bundle | `zip` archive (optional) | Mixed | Includes activity log, stage durations, error traces |

## 3. Data Model Extensions

- Enhance `JobSummary` with:
  ```ts
  interface JobSummary {
    totalBookmarks: number;
    duplicatesFound: number;
    duplicatesResolved: number;
    conflictsDetected: number;
    conflictsResolved: number;
    autoApplied: boolean;
    runtimeMs: number;
    startedAt: string;
    completedAt: string;
    reviewQueueSize: number;
  }
  ```
- Extend `JobActivity` entries to include `stage`, `action`, and `details` for richer filtering.

## 4. Export Generation Pipeline

### 4.1 Export Manager Module
- Create `background/exportManager.js`:
  - Accept job summary & activity log.
  - Generate CSV with columns: `timestamp`, `stage`, `event`, `details`, `targetUrl`, `duplicateOf`.
  - Generate JSON by serializing summary + activity + review queue.
  - Support redaction based on privacy setting (mask URLs/titles).
  - Provide `downloadExport({ format, jobId })` method returning `blob://` URL via `chrome.downloads`.

### 4.2 Trigger Points
- On job completion, store summary in snapshot and mark export as ready.
- `ReportModal` in popup offers buttons for CSV/JSON export; clicking calls `EXPORT_REPORT` message to service worker.
- Allow background scheduling (e.g., nightly) to auto-export to user-specified folder (future enhancement pending permissions).

## 5. Metrics Dashboard

- Extend `MetricsPanel` to display:
  - Total processed, duplicates resolved, manual review pending.
  - Average similarity, tagging accuracy (if available).
  - Sync conflict count and resolution suggestion.
- Provide comparative metrics (e.g., trending duplicates per run) by reading past job summaries stored in `chrome.storage.local.jobHistory`.

## 6. History & Archiving

- Maintain `jobHistory` array with capped length (e.g., last 10 runs) capturing summary and file references.
- Provide popup dropdown to inspect previous runs; clicking loads summary & activity into activity feed (read-only mode).

## 7. Privacy & Redaction

- Options page configuration:
  - `redactUrls` toggle.
  - `includeActivityDetails` toggle.
  - `autoDeleteHistoryAfter` (days) numeric input.
- Export manager respects toggles:
  - When redaction active, replace URLs with hash and provide legend in export.

## 8. Error Handling

- If export generation fails, log activity entry (`level: 'error'`) and show toast in popup.
- Retry mechanism: `EXPORT_REPORT` message responds with `success: false`; UI offers “Try again”.
- When storage quota exceeded, prompt user to clear history or adjust retention.

## 9. Documentation Updates

- Update [`README.md`](README.md:1) with instructions for generating reports and privacy controls.
- Expand `BUILD_SUMMARY.md` with steps for retrieving exports and verifying metrics.
- Add `docs/reporting-guide.md` (future) with CSV schema definitions and integration notes.

## 10. Testing Strategy

- Unit tests for export manager verifying CSV headers, redaction logic, and JSON structure (`tests/export-manager.spec.ts`).
- Integration test simulating job completion and verifying `EXPORT_REPORT` produces expected file.
- Manual tests:
  - Generate CSV/JSON with privacy toggles on/off.
  - Load audit log bundle and confirm zipped contents.
  - Validate downloads in Edge (popups allowed).

## 11. Rollout Plan

1. Implement export manager and job history persistence.
2. Hook into job completion event to populate summary.
3. Add ReportModal UI and connect to exports.
4. Introduce options page controls for retention and redaction.
5. Update docs/tests, collect QA evidence (screenshots, sample exports).
