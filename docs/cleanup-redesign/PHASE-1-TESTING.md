# Phase 1 Testing Guide: Popup to Job System Connection

## Overview

Phase 1 connects the popup UI to the background job system via real-time port-based communication, replacing the legacy polling approach with live updates.

## What Was Implemented

### 1. JobContext Provider (`popup/src/context/JobContext.tsx`)
- Establishes `chrome.runtime.connect({ name: 'job-feed' })` port connection on mount
- Listens for job events: `jobStatus`, `jobActivity`, `stageProgress`
- Provides `dispatch(command, payload)` for sending job commands
- Implements reconnection logic with exponential backoff
- Falls back to polling if port connection fails

### 2. useJob Hook (`popup/src/hooks/useJob.ts`)
- Convenient wrapper around JobContext
- Returns job state, activity, connection status
- Provides helper flags: `isRunning`, `isPaused`, `isActive`, etc.

### 3. ProgressHeader Component (`popup/src/components/ProgressHeader.tsx`)
- Displays real-time job status, stage, and progress
- Shows Pause/Resume/Cancel buttons based on job state
- ARIA-compliant progress bar with live regions
- Error banner for connection issues or job failures
- Completion summary with key metrics

### 4. Service Worker Updates (`serviceWorker.js`)
- Added `chrome.runtime.onConnect` listener for 'job-feed' ports
- Routes job commands to `jobSystem.handleCommand()`
- Sends events back to connected ports

## Testing Steps

### Test 1: Basic Connection (CRITICAL - Verify No Infinite Loop)

**Prerequisites:**
- Extension loaded in Edge
- No active jobs

**Steps:**
1. Open the extension popup
2. Open DevTools for **popup** (right-click extension icon → Inspect popup)
3. Open DevTools for **service worker**:
   - Go to `edge://extensions`
   - Find your extension
   - Click "Service Worker" link → Inspect
4. Check service worker console for connection messages

**Expected Service Worker Console:**
```
[ServiceWorker] Port connected: job-feed
[JobBus] Registering incoming port: job-feed
[JobBus] Port registered successfully: job-feed
[ServiceWorker] Port handler setup complete
```

**Expected Popup Console:**
```
[JobContext] Connecting to job bus...
[JobContext] Received message: {type: "jobConnected", portName: "job-feed"}
```

**CRITICAL: Verify No Infinite Loop**
- You should see **ONLY ONE** `[JobBus] Registering incoming port: job-feed` message
- If you see multiple registrations (2, 3, 4+), **STOP IMMEDIATELY** - there's an infinite connection loop
- Check that service worker console is NOT spamming port registrations
- ProgressHeader should NOT render (no active job)
- Tab navigation should work normally

---

### Test 2: Start a Job and Monitor Progress

**Prerequisites:**
- Azure OpenAI configured in options
- Some bookmarks in Edge

**Steps:**
1. Open popup
2. Run a test connection job:
   - Open options page (`edge://extensions` → Extension details → Extension options)
   - Click "Test Connection" button
3. Return to popup

**Expected:**
- ProgressHeader appears automatically
- Shows "Running" status with blue color
- Stage name displays (e.g., "Testing Connection")
- Progress bar animates
- Activity message updates in real-time
- Console shows `jobStatus` and `stageProgress` events

---

### Test 3: Pause and Resume

**Prerequisites:**
- Job is running (use import job for longer duration)

**Steps:**
1. Start an import job:
   - Go to Import/Export tab
   - Select a large HTML file (>100 bookmarks)
   - Click "Import Bookmarks"
2. Click **Pause** button in ProgressHeader
3. Wait 2 seconds
4. Click **Resume** button

**Expected:**
- Pause button appears when job is running
- Clicking Pause:
  - Status changes to "Paused" (gray color)
  - Progress bar stops animating
  - Resume button appears
- Clicking Resume:
  - Status changes back to "Running" (blue color)
  - Progress continues from where it left off
  - Activity feed shows "Job resumed"

**Console Verification:**
```
[JobContext] Dispatching command: PAUSE_JOB
[ServiceWorker] Port message received: {type: "jobCommand", command: "PAUSE_JOB"}
[JobContext] Received message: {type: "jobStatus", job: {...status: "paused"}}
```

---

### Test 4: Cancel Job

**Prerequisites:**
- Job is running or paused

**Steps:**
1. Click **Cancel** button
2. Confirm in dialog

**Expected:**
- Confirmation dialog appears
- After confirming:
  - ProgressHeader disappears (job cancelled)
  - Activity feed shows cancellation (if implemented in Phase 2)
  - Console shows `CANCEL_JOB` command and status change

---

### Test 5: Reconnection After Service Worker Restart

**Prerequisites:**
- Job is running

**Steps:**
1. Start a long-running job
2. Force service worker restart:
   - Go to `edge://extensions`
   - Find service worker for the extension
   - Click "Reload" or wait for service worker to idle out
3. Reopen popup

**Expected:**
- Job status shows "Paused" with message "Job paused due to service worker restart"
- ProgressHeader displays the paused state
- Resume button is available
- Console shows successful reconnection

---

### Test 6: Multiple Popup Opens

**Prerequisites:**
- Job is running

**Steps:**
1. Start a job
2. Close popup
3. Reopen popup immediately
4. Repeat 3-4 times

**Expected:**
- Each time popup opens, ProgressHeader shows current job state
- No duplicate port connections (check service worker console)
- Progress resumes from current state, not from 0%
- No memory leaks or port errors

---

### Test 7: Error Handling

**Prerequisites:**
- Job system initialized

**Steps:**
1. Open popup
2. In DevTools console for popup, run:
   ```javascript
   chrome.runtime.sendMessage({type: 'INVALID_COMMAND'})
   ```

**Expected:**
- No crashes
- Error banner may appear (depending on implementation)
- Connection remains stable

---

### Test 8: Fallback Polling

**Prerequisites:**
- Service worker supports job system

**Steps:**
1. Open popup
2. In popup DevTools console, disconnect port manually:
   ```javascript
   // This will trigger fallback polling
   ```
3. Start a job from options page

**Expected:**
- Popup falls back to polling every 5 seconds
- Console shows: `[JobContext] Polling for status (fallback mode)...`
- ProgressHeader still updates (slower, every 5s)
- Yellow banner shows "Connection lost. Trying to reconnect..."

---

## Console Debug Messages

### Normal Operation
```
[JobContext] Connecting to job bus...
[ServiceWorker] Port connected: job-feed
[JobBus] Registering incoming port: job-feed
[JobBus] Port registered successfully: job-feed
[ServiceWorker] Port handler setup complete
[JobContext] Received message: {type: "jobConnected", portName: "job-feed"}
[JobContext] Received message: {type: "jobStatus", job: {...}}
```

**Critical Check:** Make sure you see **only ONE** `[JobBus] Registering incoming port` message when the popup opens. If you see multiple registrations cascading, that indicates the infinite loop bug has returned.

### Pause Command
```
[JobContext] Dispatching command: PAUSE_JOB
[ServiceWorker] Port message received: {type: "jobCommand", command: "PAUSE_JOB", ...}
[JobContext] Received message: {type: "jobStatus", job: {...status: "paused"}}
```

### Reconnection
```
[JobContext] Port disconnected
[JobContext] Reconnecting in 1000ms (attempt 1/5)
[JobContext] Connecting to job bus...
```

---

## Known Limitations (To Be Fixed in Later Phases)

1. **No Activity Feed**: Activity events are received but not displayed yet (Phase 2)
2. **No Stage Breakdown**: Only current stage shown, no visual list of all stages (Phase 2)
3. **No Metrics Panel**: Summary data received but not displayed richly (Phase 6)
4. **No Keyboard Shortcuts**: Pause/Resume/Cancel only via mouse (Phase 4)
5. **No Reduced Motion**: Progress bar always animates (Phase 4)

---

## Regression Testing

Ensure existing functionality still works:

- [ ] Review Queue tab loads duplicates
- [ ] Accept/Reject buttons work
- [ ] Add Bookmark tab creates bookmarks
- [ ] Manage Bookmarks tab shows tree
- [ ] Import/Export buttons function
- [ ] Tab switching works
- [ ] No console errors on popup load

---

## Performance Metrics

**Target Benchmarks:**
- Initial connection: <100ms
- Event propagation (background → popup): <50ms
- Memory usage: <5MB for popup
- No memory leaks after 10+ open/close cycles

**How to Measure:**
1. Open Edge DevTools → Performance Monitor
2. Monitor JavaScript heap size while opening/closing popup
3. Check Network tab for message frequency

---

## Troubleshooting

### "Lost connection to background" Error
- **Cause**: Service worker not running or job system failed to initialize
- **Fix**: Check service worker console for errors, reload extension

### ProgressHeader Not Appearing
- **Cause**: No active job or snapshot not loaded
- **Fix**: Start a job from options page or import a file

### Port Disconnect Loop
- **Cause**: Service worker restarting frequently
- **Fix**: Check for errors in service worker, increase keep-alive time

### Events Not Updating
- **Cause**: Job bus not publishing events
- **Fix**: Verify `jobBus.publish()` calls in jobRunner.js

---

## Next Steps (Phase 2)

After Phase 1 is stable, implement:
- ActivityFeed component to display log entries
- StageList component to show all stages with progress
- useActivityFeed hook for real-time activity stream

---

## Success Criteria

Phase 1 is complete when:
- ✅ Popup connects to job bus on mount
- ✅ Real-time progress updates visible
- ✅ Pause/Resume/Cancel buttons work
- ✅ Reconnection logic functions correctly
- ✅ No polling when port is connected
- ✅ All regression tests pass
- ✅ Build completes without errors
