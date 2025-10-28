# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An AI-powered Chrome extension (Manifest V3) for Microsoft Edge that deduplicates, auto-tags, and organizes bookmarks using Azure OpenAI embeddings and chat completions. The extension uses a service worker architecture with offscreen documents for DOM parsing, and includes a modern React-based popup UI.

## Development Commands

### Building the Popup
```bash
cd popup
npm install           # Install React, Vite, TypeScript dependencies
npm run dev          # Development server with hot reload
npm run build        # Production build (outputs to ../build/popup/)
```

### Testing
```bash
npm test             # Run Node.js tests (root package.json)
```

### Loading in Edge
1. Navigate to `edge://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `bookmark-extension` folder

### Debugging
- **Service Worker**: `edge://extensions` → Service Worker → Inspect
- **Offscreen Document**: DevTools → Sources → Content Scripts
- **Popup**: Right-click extension icon → Inspect popup

## Core Architecture

### Service Worker System (serviceWorker.js)
The main orchestrator coordinates all background operations. Key responsibilities:
- Initialize job system on startup (background/jobSystem.js)
- Manage cleanup tasks (deduplication, tagging, folder suggestions)
- Handle message passing between popup, options page, and background contexts
- Maintain review queue for duplicate bookmarks
- Schedule periodic cleanups via Alarms API

### Job System (background/)
A runtime-safe job execution framework for long-running operations:
- **jobSystem.js**: Main coordinator, initializes runner and bus
- **jobRunner.js**: Executes staged jobs with progress tracking
- **jobStore.js**: Persists job state and payloads
- **jobBus.js**: Event streaming for progress updates
- **importStages.js**: Multi-stage import pipeline (parse → create → enrich)

The job system enables:
- Large HTML imports (>800 bookmarks) to run without blocking
- Real-time progress updates to popup UI
- Cancellable operations with cleanup
- Stage-aware error recovery

### OpenAI Integration
- **openaiClient.js**: Azure OpenAI API wrapper with unified/legacy endpoint support
- **embeddings.js**: Vector generation using text-embedding models, cosine similarity matching
- **tagger.js**: AI-powered tag and category generation
- **scraper.js**: Content extraction via offscreen document (Chrome 116+ `runtime.getContexts()`)

### Storage Architecture
- **Settings**: `chrome.storage.sync` (API keys, deployment names, schedule)
- **Vectors**: `chrome.storage.local` with 30-day TTL (utils/storageManager.js)
- **Review Queue**: `chrome.storage.local` (pending duplicate decisions)
- **URL Index**: In-memory normalized URL map for fast duplicate detection during imports

### Utilities (utils/)
- **rateLimiter.js**: Custom concurrent request limiter (no external deps)
- **storageManager.js**: Vector caching with expiration and quota management
- **notificationManager.js**: Progress notifications with icon support
- **duplicateDetector.js**: Cosine similarity comparison and duplicate clustering
- **tagValidator.js**: Tag quality filtering (blacklist removal, minimum tags)
- **folderOrganizer.js**: Suggests optimal bookmark folder placement
- **syncManager.js**: Conflict resolution for sync operations
- **offscreen.js**: Offscreen document lifecycle management
- **url.js**: URL normalization and pair key generation

### Popup UI (popup/src/)
React 19 + TypeScript + Vite application with tabs:
- **Review**: Accept/reject duplicate bookmarks
- **Add**: Create new bookmarks with parent folder selection
- **Manage**: Tree view for editing/deleting bookmarks
- **Import/Export**: Netscape HTML format support

### Options Page (options/)
Vanilla JavaScript settings UI for:
- Azure OpenAI configuration (API key, base URL, deployments, API version)
- Schedule selection (Daily/Weekly/Manual)
- Feature toggles (page scraping, device-only mode, preview mode)
- Manual "Run Now" trigger

## Key Implementation Patterns

### Duplicate Detection Flow
1. Extract leaf bookmarks (excludes folders)
2. For each bookmark, check storage cache for existing vector
3. If not cached, optionally scrape page content, then embed title+content
4. Compare vectors using cosine similarity (default threshold: 0.90)
5. Build duplicate clusters, keep newest/most tagged
6. Exact URL matches flagged immediately without embedding
7. Queue duplicates to review queue (if preview mode enabled)

### Import Pipeline
For large imports (>800 bookmarks or >500KB HTML):
1. Queue job via `queueImportJob(html, parentId)`
2. Stage 1 (PARSE_HTML): Parse HTML into bookmark nodes
3. Stage 2 (CREATE_BOOKMARKS): Bulk create via chrome.bookmarks API with duplicate detection
4. Stage 3 (ENRICH_BOOKMARKS): Generate embeddings and tags for new bookmarks
5. Progress events streamed to popup via jobBus

For small imports: Synchronous processing in service worker

### Rate Limiting
All OpenAI API calls wrapped in `createRateLimiter(concurrency)`:
- Default: 8 concurrent requests
- Exponential backoff on 429 (3 retries)
- Used for both embeddings and chat completions

### Offscreen Document Pattern
Edge 116+ requires `runtime.getContexts()` for lifecycle management:
1. Check if offscreen document exists via `runtime.getContexts()`
2. Create if missing: `offscreen.createDocument()`
3. Send message to offscreen for DOM parsing
4. Offscreen responds with extracted text
5. Close after idle timeout (optional)

This is required because service workers lack DOM APIs (DOMParser, fetch with CORS).

## Configuration

### Azure OpenAI Setup
- **API Version**: Use "v1" for unified endpoint, or date string (e.g., "2024-07-01-preview") for legacy
- **Base URL**: Must be `https://<resource>.openai.azure.com` (no trailing `/openai` or `/v1`)
- **Deployments**: Chat model (GPT-4/GPT-3.5-turbo) + optional embedding model
- **Scraping**: Requires `<all_urls>` optional permission, requested at runtime

### Tuning Parameters
Located in serviceWorker.js:
- **Similarity Threshold**: `threshold: 0.9` in `dedupeNodes()` call
- **Rate Limit**: `createRateLimiter(8)` for concurrent requests
- **Vector Cache TTL**: `new StorageManager(30 * 24 * 60 * 60 * 1000)` (30 days)

## Testing Strategy

### Manual Testing
Follow checklist in tests/README.md:
- Configuration persistence
- Deduplication accuracy (90%+ for true duplicates)
- CRUD operations (add, edit, delete bookmarks)
- Import/export round-trip
- Performance (<1 min for 100 bookmarks)

### Automated Testing
- Place tests in `tests/` directory
- Run with `npm test` (Node.js test runner)
- Example: `tests/importer-html.spec.mjs`

## Edge-Specific Considerations

- **No Reading List API**: Edge doesn't support `chrome.readingList`
- **Manifest Key**: Use `minimum_chrome_version`, not `minimum_edge_version`
- **Publishing**: Microsoft Partner Center, not Chrome Web Store
- **API Compatibility**: Always verify new Chrome APIs are supported in Edge

## Commit Conventions

Use Conventional Commits for CHANGELOG.md integration:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code restructuring
- `chore:` - Maintenance tasks
- `docs:` - Documentation only
- `test:` - Testing additions

## Common Tasks

### Adding a New OpenAI API Call
1. Add method to `createOpenAI()` in openaiClient.js
2. Wrap call with rate limiter: `limiter.execute(() => openai.newMethod())`
3. Handle errors with parseJsonOrThrow pattern
4. Update API cost estimates in README.md

### Adding a New Job Type
1. Define stages in background/importStages.js or new file
2. Register stages with `jobSystem.registerStage(name, handler)`
3. Create payload storage keys (e.g., `${JOB_META_PREFIX}${jobId}`)
4. Queue job via `JobSystemCommands.startJob(source, metadata)`
5. Wire progress listeners in popup for UI updates

### Modifying Duplicate Detection Logic
1. Update `dedupeNodes()` in embeddings.js
2. Adjust threshold or add domain-specific rules
3. Test with small library (10-100 bookmarks) first
4. Update DuplicateDetector in utils/duplicateDetector.js if clustering logic changes

### Adding Popup UI Features
1. Modify popup/src/App.tsx for new tabs or components
2. Use typed Chrome API calls with @types/chrome
3. Message service worker via `chrome.runtime.sendMessage()`
4. Rebuild: `cd popup && npm run build`
5. Reload extension in Edge

## Security Notes

- Never commit API keys or secrets
- API keys stored via Options UI in `chrome.storage.sync`
- Host permissions restricted in manifest.json
- Optional permissions (`<all_urls>`) requested at runtime only when scraping enabled
- Device-only mode keeps vectors in local storage (not synced)
