# Technology Stack

## Programming Languages

### JavaScript (ES Modules)
- **Version**: ES2020+ features
- **Module System**: ES6 modules (`type: "module"` in manifest)
- **Usage**: Service worker, utilities, core business logic
- **Files**: serviceWorker.js, openaiClient.js, embeddings.js, utils/*, etc.

### TypeScript
- **Version**: 5.2.2
- **Usage**: Popup UI (React components)
- **Configuration**: tsconfig.json with strict mode
- **Files**: popup/src/*.tsx

### HTML/CSS
- **Usage**: Options page, offscreen document, popup shell
- **Files**: options/options.html, offscreen.html, popup/index.html

## Runtime Environment

### Microsoft Edge (Chromium)
- **Minimum Version**: 116
- **Reason**: Offscreen documents API (runtime.getContexts)
- **APIs Used**:
  - chrome.bookmarks (read/write bookmarks)
  - chrome.storage.sync (settings, ~100 KB limit)
  - chrome.storage.local (vector cache, unlimited)
  - chrome.alarms (scheduled tasks)
  - chrome.offscreen (DOM parsing)
  - chrome.notifications (progress updates)
  - chrome.downloads (export functionality)
  - chrome.runtime (messaging, lifecycle)

### Manifest V3
- Service worker background script (non-persistent)
- Host permissions for Azure OpenAI
- Optional host permissions for page scraping

## Build System

### Vite
- **Version**: 5.2.0
- **Purpose**: Popup UI bundler
- **Configuration**: vite.config.ts
- **Output**: build/popup/
- **Commands**:
  - `npm run dev` - Development server with hot reload
  - `npm run build` - Production build (TypeScript + bundling)
  - `npm run preview` - Preview production build

### TypeScript Compiler
- **Version**: 5.2.2
- **Purpose**: Type checking and transpilation for popup
- **Configuration**: tsconfig.json
- **Target**: ES2020

## Frontend Framework

### React
- **Version**: 19.0.0
- **Usage**: Popup UI only
- **Components**: App.tsx (main component), main.tsx (entry point)
- **Build**: Compiled to build/popup/ via Vite

### React DOM
- **Version**: 19.0.0
- **Purpose**: React rendering

## External APIs

### Azure OpenAI
- **Service**: Azure OpenAI Service
- **Endpoints**:
  - Chat Completions: `/openai/deployments/{deployment}/chat/completions`
  - Embeddings: `/openai/deployments/{deployment}/embeddings`
- **API Version**: 2023-05-15 (configurable)
- **Authentication**: API key in headers
- **Models**:
  - Chat: gpt-4, gpt-35-turbo (user-configured)
  - Embeddings: text-embedding-3-small (user-configured)

## Dependencies

### Production Dependencies (Popup)
```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
}
```

### Development Dependencies (Popup)
```json
{
  "@types/chrome": "^0.0.268",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "@vitejs/plugin-react": "^4.2.1",
  "typescript": "^5.2.2",
  "vite": "^5.2.0"
}
```

### No External Dependencies (Core Extension)
- Service worker and utilities use zero external libraries
- All algorithms implemented in-house:
  - Rate limiter (token bucket)
  - Cosine similarity calculation
  - Storage manager with TTL
  - HTML parser (DOMParser in offscreen document)

## Development Commands

### Popup Build
```bash
cd popup
npm install          # Install dependencies
npm run build        # Production build → ../build/popup/
npm run dev          # Development server (hot reload)
```

### Extension Loading
1. Open `edge://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select `bookmark-extension` folder

### Debugging
- Service worker console: `edge://extensions` → Service Worker → Inspect
- Offscreen document console: Check offscreen.html context
- Popup console: Right-click popup → Inspect
- Options page console: F12 on options page

## Storage Schema

### chrome.storage.sync (Settings)
```javascript
{
  apiKey: string,
  baseUrl: string,
  chatDeployment: string,
  embeddingDeployment: string,
  enableScraping: boolean,
  deviceOnlyMode: boolean,
  previewMode: boolean,
  schedule: "daily" | "weekly" | "manual"
}
```

### chrome.storage.local (Vectors)
```javascript
{
  "vector:{url}:{hash}": {
    vector: number[],
    timestamp: number
  }
}
```

### chrome.storage.local (Review Queue)
```javascript
{
  reviewQueue: Array<{
    id: string,
    title: string,
    url: string,
    similarity: number,
    keepId: string
  }>
}
```

## API Cost Estimates

### Azure OpenAI Pricing (per 1,000 bookmarks)
- **Embeddings**: ~500 tokens/bookmark × $0.0001/1K tokens = $0.05
- **Tagging**: ~100 tokens/bookmark × $0.002/1K tokens = $0.20
- **Total**: ~$0.25 per 1,000 bookmarks (varies by model and region)

### Optimization
- Vector caching reduces repeat costs to near zero
- 30-day TTL balances freshness and cost
- Rate limiting prevents quota exhaustion

## Browser Compatibility

### Supported
- Microsoft Edge (Chromium) ≥ 116
- Google Chrome ≥ 116 (with minor manifest adjustments)

### Not Supported
- Edge Legacy (pre-Chromium)
- Firefox (different extension APIs)
- Safari (different extension APIs)

### Edge-Specific Notes
- Reading List API not supported (unlike Chrome)
- Use `minimum_chrome_version` in manifest (not `minimum_edge_version`)
- Publish via Microsoft Partner Center (not Chrome Web Store)
