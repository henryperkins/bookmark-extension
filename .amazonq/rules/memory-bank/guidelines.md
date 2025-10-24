# Development Guidelines

## Code Quality Standards

### File Organization
- **ES Modules**: All JavaScript files use ES6 module syntax (`import`/`export`)
- **Module Type**: Service worker and core modules specify `type: "module"` in manifest
- **Single Responsibility**: Each module has a clear, focused purpose (e.g., openaiClient.js only handles API communication)
- **Utility Separation**: Reusable utilities live in `utils/` directory, never in core modules

### Naming Conventions
- **Files**: camelCase for JavaScript files (e.g., `serviceWorker.js`, `storageManager.js`)
- **Classes**: PascalCase (e.g., `StorageManager`, `NotificationManager`, `SyncManager`)
- **Functions**: camelCase (e.g., `createOpenAI`, `dedupeNodes`, `normalizeUrlForKey`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `IGNORE_STORAGE_KEY`, `PAIR_SEPARATOR`)
- **Private Methods**: Prefix with underscore (e.g., `_getBucket`)
- **Boolean Variables**: Descriptive names without "is" prefix (e.g., `importInProgress`, `enableScraping`, `deviceOnly`)

### Code Formatting
- **Indentation**: 2 spaces (consistent across all files)
- **Quotes**: Double quotes for strings
- **Semicolons**: Always used at statement ends
- **Line Length**: Keep reasonable (no strict limit, but break long lines logically)
- **Blank Lines**: Single blank line between function definitions
- **Trailing Commas**: Not used in object/array literals

### Documentation Standards
- **Inline Comments**: Used sparingly, only for complex logic or non-obvious decisions
- **Function Comments**: Minimal; function names should be self-documenting
- **Warning Comments**: Use `console.warn()` for recoverable errors with context
- **Error Comments**: Use `console.error()` for critical failures
- **TODO Comments**: Not present in codebase; issues tracked externally

## Architectural Patterns

### Module Design Pattern
```javascript
// Export factory functions for stateless utilities
export function createOpenAI(config) {
  // Validate required config
  if (!config.apiKey) throw new Error("apiKey is required");
  
  // Return object with methods
  return { chat, embed };
}

// Export classes for stateful managers
export class StorageManager {
  constructor(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
    this.maxAgeMs = maxAgeMs;
  }
  
  async getVector(url, localOnly = false) {
    // Implementation
  }
}
```

**Frequency**: 5/5 files follow this pattern
- Factory functions: openaiClient.js, rateLimiter.js
- Classes: storageManager.js, NotificationManager, SyncManager

### Error Handling Pattern
```javascript
// Always catch and log errors with context
try {
  await riskyOperation();
} catch (e) {
  console.warn('Operation failed:', e);
  // Graceful degradation or fallback
}

// Use optional chaining for safe property access
const value = obj?.nested?.property || defaultValue;

// Validate inputs early
if (!url || !vector) return;
```

**Frequency**: 5/5 files use defensive error handling
- All modules validate inputs before processing
- Errors logged with descriptive context
- Graceful degradation preferred over throwing

### Async/Await Pattern
```javascript
// Always use async/await, never raw Promises
async function processBookmarks() {
  const data = await chrome.storage.local.get('key');
  const result = await apiCall(data);
  return result;
}

// Use Promise.all for parallel operations
await Promise.all(['sync', 'local'].map(async (area) => {
  await chrome.storage[area].remove('vectors');
}));
```

**Frequency**: 5/5 files exclusively use async/await
- No `.then()` chains found in codebase
- Parallel operations use `Promise.all()`

### Chrome Extension API Usage

#### Storage API Pattern
```javascript
// Always destructure storage results
const { apiKey, baseUrl } = await chrome.storage.sync.get(['apiKey', 'baseUrl']);

// Set multiple values at once
await chrome.storage.local.set({ reviewQueue, timestamp: Date.now() });

// Handle quota errors gracefully
try {
  await chrome.storage.sync.set({ vectors: bucket });
} catch (e) {
  if (/quota/i.test(e?.message || String(e))) {
    // Fallback to local storage
    await chrome.storage.local.set({ vectors: bucket });
  }
}
```

**Frequency**: 4/5 files interact with chrome.storage
- Always use destructuring for clarity
- Quota management is critical (sync has ~100KB limit)

#### Message Passing Pattern
```javascript
// Service worker: Always return true to keep port open
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    // Async work here
    const result = await processMessage(msg);
    reply(result);
  })();
  return true; // CRITICAL: Keeps message port open
});

// Popup/Options: Use sendMessage with callback
chrome.runtime.sendMessage({ type: "GET_PENDING" }, (data) => {
  setPending(data || []);
});
```

**Frequency**: 2/5 files (serviceWorker.js, App.tsx)
- Service worker ALWAYS returns `true` synchronously
- Callbacks handle async responses

### Configuration Management Pattern
```javascript
// Load config once, pass to functions
const cfg = await chrome.storage.sync.get([
  "apiKey", "baseUrl", "deployment", "embeddingDeployment"
]);

// Validate before use
if (!cfg.apiKey) {
  console.warn("API key not set");
  return;
}

// Create clients with config
const openai = createOpenAI(cfg);
```

**Frequency**: 3/5 files (serviceWorker.js, openaiClient.js)
- Config loaded once per operation
- Validation happens at point of use

## React/TypeScript Patterns (Popup UI)

### Component Structure
```typescript
// Inline styles object at top of file
const styles = {
  typography: { fontBody: '14px', lineBody: '20px' },
  spacing: { sm: '8px', md: '12px' },
  colors: { primary: '#0078d4', text: '#1a1a1a' }
} as const;

// Functional components with hooks
function ReviewQueue() {
  const [pending, setPending] = useState<Duplicate[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    refresh();
  }, []);
  
  return <div>...</div>;
}
```

**Frequency**: 1/5 files (App.tsx)
- Windows 11 design system with 8px grid
- Inline styles (no CSS modules or styled-components)
- TypeScript interfaces for type safety

### State Management Pattern
```typescript
// Local state with useState
const [filter, setFilter] = useState('');

// Refresh pattern for Chrome API data
const refresh = () => {
  setLoading(true);
  chrome.runtime.sendMessage({ type: "GET_PENDING" }, (data) => {
    setPending(data || []);
    setLoading(false);
  });
};

// Conditional rendering
{loading && <p>Loading...</p>}
{!loading && pending.length === 0 && <p>No items</p>}
```

**Frequency**: 1/5 files (App.tsx)
- No global state management (Redux, Context)
- Direct Chrome API communication from components

### Accessibility & Design Standards
```typescript
// WCAG AA compliant colors (4.5:1 contrast minimum)
colors: {
  text: '#1a1a1a',        // High contrast on white
  primary: '#0078d4',     // Microsoft Blue
  danger: '#d13438'       // Windows Red
}

// Windows 11 typography standards
typography: {
  fontBody: '14px',       // Standard body text
  lineBody: '20px',       // Line height for readability
  weightSemibold: 600     // Titles and buttons
}

// Focus states for keyboard navigation
button:focus-visible {
  outline: 2px solid #0078d4;
  outline-offset: 2px;
}
```

**Frequency**: 1/5 files (App.tsx)
- Windows 11 design system strictly followed
- Accessibility is first-class concern

## API Integration Patterns

### Azure OpenAI Client Pattern
```javascript
// Factory function returns methods
export function createOpenAI({ apiKey, baseUrl, deployment }) {
  // Validate required config
  if (!apiKey) throw new Error("apiKey is required");
  
  // Build URLs once
  const root = `${sanitizeBaseUrl(baseUrl)}/openai/v1`;
  const chatUrl = buildUrl(root, "/chat/completions", apiVersion);
  
  // Return methods with closure over config
  async function chat(messages, opts = {}) {
    const body = { model: deployment, messages, ...opts };
    const res = await fetch(chatUrl, {
      method: "POST",
      headers: { "api-key": apiKey },
      body: JSON.stringify(body)
    });
    return parseJsonOrThrow(res, "Chat error");
  }
  
  return { chat, embed };
}
```

**Frequency**: 1/5 files (openaiClient.js)
- Factory pattern with closure over config
- URL building happens once at initialization
- Consistent error handling via helper function

### URL Normalization Pattern
```javascript
// Always normalize URLs for comparison
export function normalizeUrlForKey(raw) {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const protocol = url.protocol.toLowerCase();
    const hostname = url.hostname.toLowerCase();
    let pathname = url.pathname || "/";
    // Remove trailing slashes except root
    if (pathname !== "/") {
      pathname = pathname.replace(/\/+$/, "");
    }
    return `${protocol}//${hostname}${pathname}${url.search}`.toLowerCase();
  } catch {
    return String(raw).trim().toLowerCase();
  }
}
```

**Frequency**: 1/5 files (url.js)
- Always use try/catch with URL constructor
- Fallback to string normalization on parse failure
- Lowercase everything for case-insensitive comparison

## Storage & Caching Patterns

### Vector Cache with TTL
```javascript
// Constructor with default TTL
constructor(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  this.maxAgeMs = maxAgeMs;
}

// Automatic expiration on read
async _getBucket(localOnly) {
  const { vectors } = await chrome.storage[area].get('vectors');
  let bucket = { ...(vectors || {}) };
  const cutoff = Date.now() - this.maxAgeMs;
  
  // Prune expired entries
  for (const url of Object.keys(bucket)) {
    if ((bucket[url]?.timestamp || 0) < cutoff) {
      delete bucket[url];
      changed = true;
    }
  }
  
  return { area, bucket };
}
```

**Frequency**: 1/5 files (storageManager.js)
- TTL enforced on every read operation
- Expired entries pruned automatically
- Timestamp stored with every cached item

### Quota Management Pattern
```javascript
// Check size before writing to sync storage
const sizeBytes = new Blob([JSON.stringify(payload)]).size;
if (sizeBytes > this.syncLimitBytes) {
  // Migrate to local storage
  await chrome.storage.local.set({ vectors: localBucket });
  await chrome.storage.sync.remove('vectors');
  console.warn('Migrated oversized sync vector cache to local storage.');
}

// Catch quota errors and fallback
try {
  await chrome.storage.sync.set(payload);
} catch (e) {
  if (/quota/i.test(e?.message || String(e))) {
    return this.saveVector(url, vector, true); // Retry with localOnly=true
  }
}
```

**Frequency**: 1/5 files (storageManager.js)
- Proactive size checking before sync writes
- Automatic migration to local storage on quota errors
- Graceful degradation without data loss

## Testing & Debugging Patterns

### Console Logging Strategy
```javascript
// Warnings for recoverable issues
console.warn("Cleanup already running; returning existing promise.");
console.warn('Failed to migrate oversized sync vector cache:', e);

// Errors for critical failures
console.error('Cleanup failed:', e);
console.error('Message handler error:', e);

// No debug/info logs in production code
// Use browser DevTools for debugging
```

**Frequency**: 5/5 files use consistent logging
- `console.warn()` for recoverable issues
- `console.error()` for critical failures
- No verbose debug logging

### Safe Reply Pattern (Message Handlers)
```javascript
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    let replied = false;
    const safeReply = (value) => {
      if (replied) return;
      replied = true;
      try {
        reply(value);
      } catch {
        // Port already closed; ignore.
      }
    };
    
    // Use safeReply instead of reply
    safeReply(result);
  })();
  return true;
});
```

**Frequency**: 1/5 files (serviceWorker.js)
- Prevents "Attempting to use a disconnected port" errors
- Guards against double-reply bugs
- Critical for reliable message passing

## Performance Optimization Patterns

### Lazy Initialization
```javascript
// Cache expensive computations
let ignorePairsCache = null;

async function loadIgnorePairs(force = false) {
  if (!ignorePairsCache || force) {
    const { [IGNORE_STORAGE_KEY]: stored } = await chrome.storage.local.get(IGNORE_STORAGE_KEY);
    ignorePairsCache = new Set(stored || []);
  }
  return ignorePairsCache;
}
```

**Frequency**: 2/5 files (serviceWorker.js, storageManager.js)
- Cache loaded once, reused across operations
- Force reload option for invalidation

### Serialization Optimization
```javascript
// Use typed arrays for efficient storage
function serializeVector(vec) {
  return Array.from(vec);
}

function deserializeVector(arr) {
  return new Float32Array(arr || []);
}
```

**Frequency**: 1/5 files (storageManager.js)
- Float32Array for memory-efficient vector storage
- Serialize to plain array for JSON compatibility

## Security & Validation Patterns

### Input Validation
```javascript
// Validate early, return early
if (!url || !vector) return;
if (!cfg.apiKey) {
  console.warn("API key not set");
  return;
}

// Use optional chaining for safe access
const value = obj?.nested?.property || defaultValue;
const message = e?.message || String(e);
```

**Frequency**: 5/5 files validate inputs
- Early returns prevent invalid state
- Optional chaining prevents null reference errors

### URL Sanitization
```javascript
// Remove trailing slashes from base URLs
function sanitizeBaseUrl(baseUrl = "") {
  return baseUrl.replace(/\/+$/, "");
}

// Validate URL format before use
try {
  const url = new URL(raw);
  // Process valid URL
} catch {
  // Handle invalid URL
  return fallbackValue;
}
```

**Frequency**: 2/5 files (openaiClient.js, url.js)
- Always sanitize external URLs
- Try/catch around URL constructor

## Common Idioms

### Destructuring with Defaults
```javascript
// Function parameters
async function chat(messages, opts = {}) {
  const temperature = opts.temperature ?? 0;
}

// Storage reads
const { apiKey, baseUrl } = await chrome.storage.sync.get(['apiKey', 'baseUrl']);
```

**Frequency**: 5/5 files use destructuring
- Default parameters for optional args
- Destructuring for storage reads

### Ternary for Conditional Values
```javascript
// Inline conditional rendering
{loading ? <p>Loading...</p> : <p>No items</p>}

// Conditional values
const area = localOnly ? 'local' : 'sync';
const label = n.url ? '📄 ' : '📁 ';
```

**Frequency**: 4/5 files use ternaries
- Preferred over if/else for simple conditionals
- Common in React rendering logic

### Array Methods for Iteration
```javascript
// map for transformation
const list = pending.filter(p => p.title.includes(filter));
const keys = Object.keys(bucket);

// forEach for side effects
roots.forEach(walk);

// Array.from for Set/Map conversion
Array.from(ignorePairsCache)
```

**Frequency**: 5/5 files use functional array methods
- No traditional for loops
- Functional style preferred
