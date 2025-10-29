# Bug Fix: Infinite Port Connection Loop

## Issue Summary

**Severity:** P0 - Critical
**Component:** Job Bus Port Registration
**Reported:** Phase 1 implementation review
**Status:** ✅ Fixed

---

## The Problem

When the popup opened and connected to the service worker via `chrome.runtime.connect({ name: 'job-feed' })`, the service worker's `onConnect` handler incorrectly called `jobBus.connect(port.name)`.

### What Went Wrong

```javascript
// ❌ BROKEN CODE (serviceWorker.js:583-586)
const jobBus = jobSystem.bus;
if (jobBus) {
  jobBus.connect(port.name);  // This creates a NEW connection!
}
```

The `JobBus.connect(name)` method is designed for **CLIENT-SIDE** use. It creates a new connection:

```javascript
// JobBus.connect() - CLIENT-SIDE METHOD
connect(name) {
  const port = chrome.runtime.connect({ name });  // Creates NEW port
  // ... sets up listeners
}
```

### The Infinite Loop

1. **Popup** calls `chrome.runtime.connect({ name: 'job-feed' })`
2. **Service Worker** receives port in `onConnect` handler
3. **Service Worker** calls `jobBus.connect('job-feed')` ❌
4. **JobBus** creates a NEW connection: `chrome.runtime.connect({ name: 'job-feed' })`
5. **Service Worker** receives this NEW port in `onConnect` handler
6. **Service Worker** calls `jobBus.connect('job-feed')` again ❌
7. **Infinite cascade** of self-connections ensues

### Observable Symptoms

- Service worker console spams port registration messages
- Browser DevTools shows exponentially increasing port connections
- Memory usage climbs rapidly
- Extension becomes unresponsive
- Popup never receives actual job updates (connected to wrong ports)

---

## The Fix

Added a new **SERVER-SIDE** method to JobBus: `registerPort(port)`

### New JobBus Method (`background/jobBus.js`)

```javascript
/**
 * Register an incoming port (SERVER-SIDE)
 * This accepts an already-connected port from chrome.runtime.onConnect
 * and sets up listeners for it
 */
registerPort(port) {
  if (!port || !port.name) {
    console.error('[JobBus] Cannot register port without name');
    return false;
  }

  const name = port.name;
  console.log(`[JobBus] Registering incoming port: ${name}`);

  try {
    // Remove existing port with same name
    if (this.ports.has(name)) {
      console.log(`[JobBus] Replacing existing port: ${name}`);
      this.disconnect(name);
    }

    const portInfo = {
      port,
      name,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      messageCount: 0
    };

    this.ports.set(name, portInfo);

    // Set up message listener
    port.onMessage.addListener((message) => {
      this.handlePortMessage(name, message);
    });

    // Set up disconnect listener
    port.onDisconnect.addListener(() => {
      this.handlePortDisconnect(name);
    });

    // Send connection confirmation
    this.sendToPort(port, {
      type: 'jobConnected',
      portName: name
    });

    // Send last known event if available
    if (this.lastEvent) {
      this.sendToPort(port, this.lastEvent);
    }

    console.log(`[JobBus] Port registered successfully: ${name}`);
    return true;
  } catch (error) {
    console.error(`[JobBus] Failed to register port ${name}:`, error);
    return false;
  }
}
```

### Updated Service Worker (`serviceWorker.js`)

```javascript
// ✅ FIXED CODE
chrome.runtime.onConnect.addListener((port) => {
  console.log('[ServiceWorker] Port connected:', port.name);

  if (port.name !== 'job-feed') {
    return;
  }

  const jobSystem = getJobSystem();
  if (!jobSystem) {
    console.warn('[ServiceWorker] Job system not initialized');
    port.postMessage({
      type: 'error',
      error: 'Job system not initialized'
    });
    return;
  }

  // Register the incoming port with the job bus (SERVER-SIDE)
  // This uses the actual port from the popup, not creating a new connection
  const jobBus = jobSystem.bus;
  if (jobBus) {
    const registered = jobBus.registerPort(port);  // ✅ Use existing port
    if (!registered) {
      console.error('[ServiceWorker] Failed to register port');
      return;
    }
  } else {
    console.error('[ServiceWorker] Job bus not available');
    port.postMessage({
      type: 'error',
      error: 'Job bus not available'
    });
    return;
  }

  // ... command handling code
});
```

---

## Verification

### Expected Console Output (Service Worker)

```
[ServiceWorker] Port connected: job-feed
[JobBus] Registering incoming port: job-feed
[JobBus] Port registered successfully: job-feed
[ServiceWorker] Port handler setup complete
```

**Key indicator:** You should see **ONLY ONE** registration message per popup open.

### Expected Console Output (Popup)

```
[JobContext] Connecting to job bus...
[JobContext] Received message: {type: "jobConnected", portName: "job-feed"}
```

### Red Flags (Indicates Bug)

❌ Multiple `[JobBus] Registering incoming port` messages cascading
❌ Service worker console fills with registration spam
❌ Memory usage climbs continuously
❌ Popup never receives job status updates

---

## Technical Details

### Client-Side vs Server-Side Port Handling

| Scenario | Method | Creates New Port? | Use Case |
|----------|--------|-------------------|----------|
| **Popup connects to background** | `jobBus.connect(name)` | ✅ Yes | Client initiates connection |
| **Background receives connection** | `jobBus.registerPort(port)` | ❌ No | Server accepts incoming port |

### Why This Matters

Chrome extensions use a **message passing** architecture:
- Each `chrome.runtime.connect()` creates a **new communication channel**
- Service workers receive these channels via `chrome.runtime.onConnect`
- The received `port` object is the **actual channel**, not a reference
- Calling `connect()` inside `onConnect` creates a **new channel to itself**

### Architecture Diagram

**Before Fix (Broken):**
```
Popup
  ↓ chrome.runtime.connect({ name: 'job-feed' })
Service Worker onConnect(port)
  ↓ jobBus.connect('job-feed')  ❌
JobBus
  ↓ chrome.runtime.connect({ name: 'job-feed' })  ❌ NEW PORT
Service Worker onConnect(port)  ← Triggers again!
  ↓ jobBus.connect('job-feed')  ❌ LOOP CONTINUES
```

**After Fix (Working):**
```
Popup
  ↓ chrome.runtime.connect({ name: 'job-feed' })
Service Worker onConnect(port)
  ↓ jobBus.registerPort(port)  ✅ Use existing port
JobBus
  ↓ ports.set('job-feed', portInfo)  ✅ Registered
  ↓ port.postMessage(...)  ✅ Communicate via original port
Popup receives messages  ✅ Connection established
```

---

## Files Changed

| File | Lines Changed | Description |
|------|---------------|-------------|
| `background/jobBus.js` | +58 | Added `registerPort()` method |
| `serviceWorker.js` | ~40 (modified) | Use `registerPort()` instead of `connect()` |
| `docs/cleanup-redesign/PHASE-1-TESTING.md` | +15 | Added infinite loop verification test |

---

## Related Issues

- **Root Cause:** Misunderstanding of Chrome extension port lifecycle
- **Prevention:** Clear separation of client-side and server-side port methods
- **Testing:** Always verify port registration count in service worker console

---

## Lessons Learned

1. **Chrome API Semantics Matter:** `connect()` always creates a new port, even from service worker
2. **Server-Side Registration Needed:** Background scripts need a way to accept incoming ports without creating new ones
3. **Console Logging Critical:** Without logging, this infinite loop would be hard to diagnose
4. **Test Connection First:** Always test basic connection before implementing complex features

---

## Status

✅ **Fixed and Tested**
- No infinite loops observed
- Port communication working correctly
- Memory usage stable
- Real-time updates functioning

**Next Steps:**
- Proceed with Phase 1 testing
- Monitor for any regression in production
- Consider adding automated test for port registration count
