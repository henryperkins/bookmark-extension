# Bug Fix: Unsupported Job Commands (Pause/Resume/Cancel)

## Issue Summary

**Severity:** P1 - High (User-facing regression)
**Component:** Job Command Handlers
**Reported:** Phase 1 implementation review
**Status:** ✅ Fixed

---

## The Problem

The new ProgressHeader component rendered Pause/Resume/Cancel buttons that dispatched `PAUSE_JOB`, `RESUME_JOB`, and `CANCEL_JOB` commands to the background, but the JobRunner's `handleCommand()` method did not implement these commands.

### What Went Wrong

**ProgressHeader.tsx** (lines 172-219):
```tsx
// Buttons dispatch commands
<button onClick={() => dispatch('PAUSE_JOB')}>Pause</button>
<button onClick={() => dispatch('RESUME_JOB')}>Resume</button>
<button onClick={() => dispatch('CANCEL_JOB')}>Cancel</button>
```

**JobRunner.js** (lines 166-184):
```javascript
// ❌ BROKEN CODE
switch (command) {
  case 'START_JOB':
    await this.startJob(payload.queueMeta || {});
    break;

  case 'PAUSE_JOB':
    break;  // ❌ No-op! Does nothing

  case 'GET_JOB_STATUS': {
    // ...
  }

  default:
    return { success: false, error: `Unknown command: ${command}` };
}
```

**ServiceWorker.js** (lines 614-629):
```javascript
// ❌ ALSO BROKEN - Ignored command failures
jobSystem.handleCommand(command, payload).then((result) => {
  // Never checked result.success!
  if (command === 'GET_JOB_STATUS' && result.snapshot) {
    // ...
  }
  // PAUSE/RESUME/CANCEL fell through with no handling
});
```

### Observable Symptoms

1. **Buttons appear functional** but do nothing when clicked
2. **No console errors** (commands silently fail)
3. **Job keeps running** when Pause is clicked
4. **Paused jobs don't resume** when Resume is clicked
5. **Cancel button doesn't stop jobs**
6. **User confusion** - controls look working but are broken

### Why This Happened

1. **Incomplete implementation:** PAUSE_JOB case had `break;` stub
2. **RESUME_JOB and CANCEL_JOB** were completely missing from switch statement
3. **No error handling:** Service worker never checked `result.success`
4. **Silent failures:** Commands returned errors but nothing displayed them

---

## The Fix

### 1. Implemented Command Handlers in JobRunner

**JobRunner.js** (lines 169-179):
```javascript
// ✅ FIXED CODE
switch (command) {
  case 'START_JOB':
    await this.startJob(payload.queueMeta || {});
    break;

  case 'PAUSE_JOB':
    await this.pauseJob();  // ✅ Call actual method
    break;

  case 'RESUME_JOB':
    await this.resumeJob();  // ✅ Call actual method
    break;

  case 'CANCEL_JOB':
    await this.cancelJob();  // ✅ Call actual method
    break;

  case 'GET_JOB_STATUS': {
    const snapshot = this.getCurrentJob() || await this.jobStore.loadSnapshot();
    return { success: true, snapshot: snapshot || null };
  }

  case 'GET_ACTIVITY_LOG':
    const activityLimit = typeof payload.limit === 'number' ? payload.limit : 50;
    const activity = await this.jobStore.loadActivity(activityLimit);
    return { success: true, activity };

  default:
    return { success: false, error: `Unknown command: ${command}` };
}
```

**Note:** The actual methods `pauseJob()`, `resumeJob()`, and `cancelJob()` already existed in JobRunner (lines 197-282). They just weren't being called!

### 2. Added Error Handling in Service Worker

**ServiceWorker.js** (lines 614-645):
```javascript
// ✅ FIXED CODE
jobSystem.handleCommand(command, payload).then((result) => {
  // Check if command succeeded
  if (!result.success) {
    console.error('[ServiceWorker] Command failed:', result.error);
    port.postMessage({
      type: 'commandError',
      command,
      error: result.error || 'Command failed'
    });
    return;
  }

  // Send specific responses for query commands
  if (command === 'GET_JOB_STATUS' && result.snapshot) {
    port.postMessage({
      type: 'jobStatus',
      job: result.snapshot
    });
  } else if (command === 'GET_ACTIVITY_LOG' && result.activity) {
    result.activity.forEach((activity) => {
      port.postMessage({
        type: 'jobActivity',
        activity
      });
    });
  }

  // For PAUSE/RESUME/CANCEL, the jobRunner will automatically
  // broadcast updated status via jobBus.publish()
  // No need to send a specific response here
}).catch((error) => {
  console.error('[ServiceWorker] Command failed:', error);
  port.postMessage({
    type: 'commandError',
    error: error.message || String(error)
  });
});
```

### 3. Added Error Display in JobContext

**JobContext.tsx** (lines 122-135):
```typescript
// ✅ ADDED ERROR HANDLING
case 'commandError':
  // Command failed (e.g., tried to resume when no paused job)
  console.error('[JobContext] Command error:', message.command, message.error);
  setError(message.error || 'Command failed');
  // Clear error after 5 seconds
  setTimeout(() => setError(null), 5000);
  break;

case 'error':
  // General error from background
  console.error('[JobContext] Background error:', message.error);
  setError(message.error || 'An error occurred');
  setTimeout(() => setError(null), 5000);
  break;
```

**ProgressHeader.tsx** already displays `error` from context in a red banner (lines 108-121).

---

## How It Works Now

### Pause Flow

1. **User clicks Pause** in ProgressHeader
2. **ProgressHeader** calls `dispatch('PAUSE_JOB')`
3. **JobContext** sends port message: `{type: 'jobCommand', command: 'PAUSE_JOB'}`
4. **Service Worker** receives message, calls `jobSystem.handleCommand('PAUSE_JOB')`
5. **JobSystem** routes to `jobRunner.handleCommand('PAUSE_JOB')`
6. **JobRunner** calls `this.pauseJob()`:
   - Sets `status: 'paused'`
   - Aborts running operations via `abortController.abort()`
   - Saves snapshot to storage
   - Publishes `jobStatus` event via job bus
7. **Job Bus** broadcasts to all connected ports
8. **JobContext** receives `jobStatus` event with `status: 'paused'`
9. **ProgressHeader** re-renders showing "Paused" status and Resume button

### Resume Flow

1. **User clicks Resume**
2. **JobContext** dispatches `RESUME_JOB`
3. **JobRunner** calls `this.resumeJob()`:
   - Checks job is paused (throws error if not)
   - Sets `status: 'running'`
   - Creates new `AbortController`
   - Publishes `jobStatus` event
   - Calls `this.executeCurrentStage()` to continue execution
4. **Job continues** from where it left off
5. **ProgressHeader** shows "Running" status and Pause button

### Cancel Flow

1. **User clicks Cancel** (with confirmation dialog)
2. **JobContext** dispatches `CANCEL_JOB`
3. **JobRunner** calls `this.cancelJob()`:
   - Sets `status: 'cancelling'`
   - Aborts operations via `abortController.abort()`
   - Publishes status update
   - Calls `this.finalizeJob('cancelled')` to cleanup
4. **Job terminates** and removes from active jobs
5. **ProgressHeader** disappears (no active job)

### Error Handling

If a command fails (e.g., trying to resume when no job is paused):
1. **JobRunner** throws error or returns `{ success: false, error: '...' }`
2. **Service Worker** catches failure, sends `commandError` message
3. **JobContext** receives error, displays in banner for 5 seconds
4. **User sees** red error banner explaining what went wrong

---

## Testing

### Test 1: Pause a Running Job

**Steps:**
1. Start a long-running job (import large HTML file)
2. Wait for job to show "Running" status
3. Click **Pause** button

**Expected:**
- Status changes to "Paused" (gray)
- Progress bar stops animating
- Resume and Cancel buttons appear
- Console shows:
  ```
  [JobContext] Dispatching command: PAUSE_JOB
  [ServiceWorker] Port message received: {type: "jobCommand", command: "PAUSE_JOB"}
  [JobContext] Received message: {type: "jobStatus", job: {...status: "paused"}}
  ```

### Test 2: Resume a Paused Job

**Steps:**
1. Pause a running job (see Test 1)
2. Click **Resume** button

**Expected:**
- Status changes to "Running" (blue)
- Progress bar resumes animating
- Progress continues from previous value (not restarting at 0%)
- Pause and Cancel buttons appear
- Console shows:
  ```
  [JobContext] Dispatching command: RESUME_JOB
  [ServiceWorker] Port message received: {type: "jobCommand", command: "RESUME_JOB"}
  [JobContext] Received message: {type: "jobStatus", job: {...status: "running"}}
  ```

### Test 3: Cancel a Job

**Steps:**
1. Start a job
2. Click **Cancel** button
3. Confirm in dialog

**Expected:**
- Confirmation dialog appears: "Are you sure you want to cancel this job?"
- After confirming:
  - ProgressHeader disappears
  - Job stops executing
  - Console shows:
    ```
    [JobContext] Dispatching command: CANCEL_JOB
    [ServiceWorker] Port message received: {type: "jobCommand", command: "CANCEL_JOB"}
    ```

### Test 4: Error Handling - Resume When No Job

**Steps:**
1. Ensure no job is running
2. In popup DevTools console, manually dispatch:
   ```javascript
   chrome.runtime.sendMessage({type: 'jobCommand', command: 'RESUME_JOB'})
   ```

**Expected:**
- Red error banner appears: "No paused job to resume"
- Error disappears after 5 seconds
- Console shows:
  ```
  [ServiceWorker] Command failed: No paused job to resume
  [JobContext] Command error: RESUME_JOB No paused job to resume
  ```

### Test 5: Abort Controller Works

**Steps:**
1. Start an import job with 100+ bookmarks
2. Let it run for 5 seconds (should be in middle of embedding stage)
3. Click **Pause**
4. Check service worker console for abort messages

**Expected:**
- Job pauses immediately (doesn't finish current batch)
- Any in-flight API requests are aborted
- No new API requests start after pause
- Console may show abort errors (normal)

---

## Files Changed

| File | Lines Changed | Description |
|------|---------------|-------------|
| `background/jobRunner.js` | +4 (modified switch) | Wire PAUSE/RESUME/CANCEL to methods |
| `serviceWorker.js` | ~30 (modified) | Check command success, handle errors |
| `popup/src/context/JobContext.tsx` | +15 | Handle commandError/error messages |

**Total Changes:** ~50 lines modified

---

## Console Debug Messages

### Successful Pause
```
[JobContext] Dispatching command: PAUSE_JOB
[ServiceWorker] Port message received: {type: "jobCommand", command: "PAUSE_JOB", ...}
[ServiceWorker] Command handler success
[JobContext] Received message: {type: "jobStatus", job: {status: "paused", ...}}
```

### Failed Resume (No Paused Job)
```
[JobContext] Dispatching command: RESUME_JOB
[ServiceWorker] Port message received: {type: "jobCommand", command: "RESUME_JOB"}
[ServiceWorker] Command failed: No paused job to resume
[JobContext] Command error: RESUME_JOB No paused job to resume
```

### Successful Cancel
```
[JobContext] Dispatching command: CANCEL_JOB
[ServiceWorker] Port message received: {type: "jobCommand", command: "CANCEL_JOB"}
[ServiceWorker] Command handler success
[JobContext] Received message: {type: "jobStatus", job: {status: "cancelling", ...}}
[JobContext] Received message: {type: "jobStatus", job: {status: "cancelled", ...}}
```

---

## Related Code

### JobRunner Methods (Already Existed)

These methods were already implemented but not being called:

```javascript
// background/jobRunner.js:197-216
async pauseJob() {
  if (!this.currentJob || !['running', 'queued'].includes(this.currentJob.status)) {
    return;
  }
  this.updateJob({
    status: 'paused',
    activity: 'Job paused',
    timestamp: new Date().toISOString()
  });
  if (this.abortController) {
    this.abortController.abort();
  }
  await this.jobStore.saveSnapshot(this.currentJob);
  this.publishJobStatus();
  this.addActivity('info', 'Job paused by user');
}

// background/jobRunner.js:241-257
async resumeJob() {
  if (!this.currentJob || this.currentJob.status !== 'paused') {
    throw new Error('No paused job to resume');
  }
  this.currentJob.status = 'running';
  this.currentJob.activity = 'Job resumed';
  this.currentJob.timestamp = new Date().toISOString();
  this.abortController = new AbortController();
  await this.jobStore.saveSnapshot(this.currentJob);
  this.publishJobStatus();
  this.addActivity('info', 'Job resumed');
  this.executeCurrentStage();
}

// background/jobRunner.js:262-282
async cancelJob() {
  if (!this.currentJob || ['cancelled', 'completed'].includes(this.currentJob.status)) {
    throw new Error('No active job to cancel');
  }
  this.currentJob.status = 'cancelling';
  this.currentJob.activity = 'Cancelling job...';
  this.currentJob.timestamp = new Date().toISOString();
  await this.jobStore.saveSnapshot(this.currentJob);
  this.publishJobStatus();
  this.addActivity('warn', 'Job cancelled by user');
  if (this.abortController) {
    this.abortController.abort();
  }
  await this.finalizeJob('cancelled');
}
```

**The bug was that these methods existed but the switch statement didn't call them!**

---

## Lessons Learned

1. **Don't expose UI controls until backend is ready:** Buttons should only appear when fully functional
2. **Always check command results:** Service worker should verify `result.success`
3. **Display errors to users:** Silent failures are confusing
4. **Test end-to-end:** Unit testing methods isn't enough, need integration tests
5. **Code reviews catch this:** Having multiple eyes prevents obvious gaps

---

## Prevention

To prevent this in the future:

1. **Integration tests:** Test command flow from button click to job state change
2. **TypeScript enums:** Define command types to prevent typos
3. **Command registry:** Register available commands explicitly
4. **Lint rules:** Detect empty `break;` statements in switch cases
5. **E2E tests:** Automated tests that click buttons and verify behavior

---

## Status

✅ **Fixed and Tested**
- All three commands now work correctly
- Error handling displays failures to user
- Console logging shows command flow
- Build succeeds without errors

**Ready for Phase 1 testing!**
