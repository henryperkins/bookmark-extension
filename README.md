# Edge Bookmark Cleaner

AI-powered bookmark deduplication and organization for Microsoft Edge using Azure OpenAI.

## Features

- **AI Deduplication**: Uses Azure OpenAI embeddings to find and remove duplicate bookmarks based on semantic similarity
- **Auto-Tagging**: Automatically tags bookmarks with relevant categories
- **Smart Organization**: Suggests optimal folder placement for bookmarks
- **Review Queue**: Preview duplicates before deletion with similarity scores
- **Scheduled Cleanup**: Daily or weekly automatic cleanup
- **Import/Export**: Standard Netscape HTML format support
- **Rate Limiting**: Built-in request throttling to respect API limits
- **Storage Management**: Efficient vector caching with quota management

## Architecture

### MV3 Service Worker Pattern
- Offscreen documents for DOM parsing (Chrome 116+)
- `runtime.getContexts()` for lifecycle management
- Alarm API for scheduling
- Storage API with quota handling

### Core Modules
- `serviceWorker.js` - Main orchestrator
- `openaiClient.js` - Azure OpenAI wrapper
- `embeddings.js` - Vector generation and duplicate detection
- `tagger.js` - AI-powered tag generation
- `scraper.js` - Page content extraction via offscreen document
- `writer.js` - Bookmark update/deletion operations

### Utilities (`utils/`)
- `rateLimiter.js` - Custom rate limiting (no external dependencies)
- `storageManager.js` - Vector cache with expiration
- `notificationManager.js` - Progress notifications
- `duplicateDetector.js` - Cosine similarity comparison
- `tagValidator.js` - Tag quality filtering
- `folderOrganizer.js` - Folder suggestion logic
- `syncManager.js` - Conflict resolution
- `offscreen.js` - Offscreen document lifecycle

## Prerequisites

- **Edge (Chromium) ≥ 116**
- **Node.js 18+** (for building the popup)
- **Azure OpenAI** resource with:
  - Chat model deployment (e.g., `gpt-4`, `gpt-35-turbo`)
  - Embeddings model deployment (e.g., `text-embedding-3-small`)

## Setup

### 1. Clone and Install

```bash
cd bookmark-extension
cd popup
npm install
```

### 2. Build the Popup

```bash
npm run build
```

This outputs to `../build/popup/`.

### 3. Add Icons

Place three PNG icons in the `icons/` directory:
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

See `icons/README.md` for details.

### 4. Load Extension in Edge

1. Open `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `bookmark-extension` folder

### 5. Configure Azure OpenAI

1. Click the extension icon → **Options**
2. Enter:
   - **API Key**: Your Azure OpenAI key
   - **Base URL**: `https://YOUR-RESOURCE.openai.azure.com`
   - **Chat Deployment**: Your GPT deployment name
   - **Embedding Deployment**: Your embedding model deployment name (optional, defaults to chat deployment)
3. Configure behavior:
   - **Enable page scraping**: Fetches page content for better embeddings (requires `<all_urls>` permission)
   - **Device-only mode**: Stores vectors in local storage instead of sync (recommended for large bookmark libraries)
   - **Preview mode**: Review duplicates before deletion (recommended)
4. Set schedule: Daily, Weekly, or Manual
5. Click **Save Settings**

## Usage

### Manual Cleanup

1. Go to Options page
2. Click **Run Now**
3. Monitor progress via notifications
4. Review duplicates in the popup (if preview mode enabled)

### Review Queue

1. Click extension icon → **Review** tab
2. See all detected duplicates with similarity scores
3. **Accept**: Remove the duplicate
4. **Reject**: Keep the bookmark
5. **Accept All**: Bulk remove all duplicates

### Add Bookmarks

1. Extension icon → **Add** tab
2. Enter title, URL, and parent folder ID
3. Click **Add Bookmark**

### Manage Bookmarks

1. Extension icon → **Manage** tab
2. View tree structure
3. Click titles to edit
4. Click **Delete** to remove

### Import/Export

1. Extension icon → **Import/Export** tab
2. **Export**: Downloads Netscape HTML file
3. **Import**: Upload HTML file and specify parent folder

## Configuration

### Storage

- **Settings**: `chrome.storage.sync` (~100 KB limit)
- **Vectors**: `chrome.storage.local` (with `unlimitedStorage` permission)
- **Review Queue**: `chrome.storage.local`

### Rate Limiting

Default: 8 concurrent requests with exponential backoff (3 retries).

Customize in `serviceWorker.js`:
```javascript
const limiter = createRateLimiter(8); // Max concurrent requests
```

### Duplicate Detection

Default similarity threshold: 90%

Adjust in `serviceWorker.js`:
```javascript
const { keep, dupes } = await dedupeNodes(leaves, openai, {
  threshold: 0.9, // 90% similarity
  // ...
});
```

### Vector Cache TTL

Default: 30 days

Adjust in `serviceWorker.js`:
```javascript
const storage = new StorageManager(30 * 24 * 60 * 60 * 1000); // milliseconds
```

## Permissions

### Required
- `bookmarks` - Read/write bookmarks
- `storage` - Settings and cache
- `downloads` - Export functionality
- `alarms` - Scheduled cleanup
- `offscreen` - DOM parsing
- `notifications` - Progress updates
- `unlimitedStorage` - Large vector caches

### Host Permissions
- `https://*.openai.azure.com/*` - Azure OpenAI API

### Optional
- `<all_urls>` - Page scraping (requested at runtime when enabled)

## Development

### Project Structure

```
bookmark-extension/
├── manifest.json           # MV3 manifest
├── serviceWorker.js        # Background service worker
├── openaiClient.js         # Azure OpenAI client
├── embeddings.js           # Vector generation & dedup
├── tagger.js               # AI tagging
├── scraper.js              # Content extraction
├── writer.js               # Bookmark mutations
├── bookmarksCrud.js        # CRUD operations
├── exporter.js             # Netscape HTML export
├── importer.js             # HTML import
├── lib/
│   └── cosine.js           # Similarity calculation
├── utils/
│   ├── rateLimiter.js      # Custom rate limiter
│   ├── storageManager.js   # Vector cache
│   ├── notificationManager.js
│   ├── duplicateDetector.js
│   ├── tagValidator.js
│   ├── folderOrganizer.js
│   ├── syncManager.js
│   └── offscreen.js        # Offscreen lifecycle
├── offscreen.html          # Offscreen document
├── offscreenScraper.js     # DOM parsing logic
├── options/
│   ├── options.html        # Settings UI
│   └── options.js          # Settings logic
├── popup/                  # React app (source)
│   ├── src/
│   │   ├── App.tsx         # Main UI
│   │   └── main.tsx        # Entry point
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── build/popup/            # Compiled popup (generated)
└── icons/                  # Extension icons
```

### Building

```bash
# Build popup for production
cd popup
npm run build

# Development mode (hot reload)
npm run dev
```

### Testing

Load the extension in Edge with Developer mode and check:
- Console logs in service worker (edge://extensions → Service Worker → Inspect)
- Offscreen document console
- Popup console
- Options page console

### Component testing (popup)

We ship Vitest + React Testing Library for popup components.

Commands:
```bash
cd popup
npm install
npm run test      # Headless run (dot reporter)
npm run test:ui   # Interactive watch mode
```

Test locations:
- [`ProgressHeader.test.tsx`](popup/src/components/__tests__/ProgressHeader.test.tsx:1)
- [`StageList.test.tsx`](popup/src/components/__tests__/StageList.test.tsx:1)
- `ActivityFeed.test.tsx` (coming alongside Phase 2)

### QA screenshots (Phase 2)

Capture screenshots in the popup for:
- Running: header shows Running; StageList highlights active stage; ActivityFeed receives live entries.
- Paused: header shows Paused; StageList progress frozen; an activity entry logs the pause.
- Completed: header shows Completed; MetricsPanel displays summary cards (totals, runtime).
- Reconnection: after reloading the service worker, popup shows reconnection banner then recovers; Resume continues job.

Tip: Open both popup and service worker DevTools. On popup open, ensure exactly one
“[JobBus] Registering incoming port: job-feed” line appears (no cascading connections).

### Debug logging toggle

To enable verbose logs in background and popup:
```js
// In any DevTools console (popup or service worker)
chrome.storage.local.set({ debugLogs: true })
```

Disable with:
```js
chrome.storage.local.set({ debugLogs: false })
```

## Packaging for Microsoft Store

1. Build the popup: `cd popup && npm run build`
2. Ensure icons are present
3. Zip the entire folder (exclude `node_modules`, `.git`, etc.)
4. Submit to [Microsoft Partner Center](https://partner.microsoft.com/dashboard)

### Recommended .gitignore

```
node_modules/
build/
dist/
*.log
.DS_Store
.env
```

## API Costs

Approximate costs per 1,000 bookmarks (Azure OpenAI):

- **Embeddings** (~500 tokens/bookmark): $0.10 - $0.50
- **Tagging** (~100 tokens/bookmark): $0.05 - $0.20

**Total**: ~$0.15 - $0.70 per 1,000 bookmarks (varies by model)

Cache vectors to avoid re-embedding on subsequent runs.

## Troubleshooting

### Extension won't load
- Check manifest syntax
- Verify all file paths exist
- Build the popup first (`cd popup && npm run build`)

### No progress notifications
- Check `notifications` permission in manifest
- Verify icon path in `notificationManager.js`

### API errors
- Verify API key and base URL in Options
- Check deployment names match your Azure resources
- Review service worker console for detailed errors

### Quota exceeded
- Enable "Device-only mode" in Options
- Clear old vectors: Open DevTools → Application → Storage → Clear Site Data

### Offscreen document errors
- Edge version must be ≥ 116
- Check `runtime.getContexts` support
- Review offscreen console logs

## Edge-Specific Notes

- **Reading List API**: NOT supported in Edge (remove `readingList` permission if copying from Chrome)
- **Manifest key**: Use `minimum_chrome_version`, not `minimum_edge_version`
- **Publishing**: Use Microsoft Partner Center, not Chrome Web Store

## License

MIT

## Contributing

PRs welcome! Please:
1. Test in Edge (not just Chrome)
2. Follow existing code style
3. Update docs for new features

## Credits

Built with:
- Azure OpenAI (embeddings + chat)
- React + TypeScript + Vite
- Chrome Extensions MV3 APIs
