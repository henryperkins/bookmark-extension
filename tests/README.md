# Testing Guide

## Manual Testing Checklist

### Setup
- [ ] Extension loads without errors in Edge
- [ ] All icons display correctly
- [ ] Options page opens and displays properly
- [ ] Popup opens and displays all tabs

### Configuration
- [ ] Can save Azure OpenAI settings
- [ ] Settings persist after browser restart
- [ ] Schedule options update correctly
- [ ] "Run Now" button triggers cleanup

### Core Functionality
- [ ] Deduplication finds similar bookmarks
- [ ] Similarity scores are accurate (90%+ for true duplicates)
- [ ] Tags are relevant to bookmark content
- [ ] Review queue displays duplicates correctly
- [ ] Accept/Reject buttons work
- [ ] Accept All removes all duplicates

### Bookmarks CRUD
- [ ] Can add new bookmarks
- [ ] Can edit bookmark titles
- [ ] Can delete bookmarks
- [ ] Tree view displays correctly

### Import/Export
- [ ] Export creates valid Netscape HTML file
- [ ] Exported file can be re-imported
- [ ] Import preserves bookmark structure

### Scheduling
- [ ] Daily alarm is created correctly
- [ ] Weekly alarm is created correctly
- [ ] Manual mode disables alarms

### Performance
- [ ] 100 bookmarks process in < 1 minute
- [ ] 1,000 bookmarks process in < 5 minutes
- [ ] UI remains responsive during cleanup

### Storage
- [ ] Vectors cache properly
- [ ] Device-only mode uses local storage
- [ ] Sync mode respects quota limits
- [ ] Old vectors are cleaned up (30-day TTL)

### Error Handling
- [ ] Invalid API key shows clear error
- [ ] Network failures retry with backoff
- [ ] Missing permissions prompt user
- [ ] Quota exceeded shows helpful message

## Unit Testing

For automated testing, consider:

### Jest + Chrome Extensions Mock

```bash
cd tests
npm install --save-dev jest @types/jest @types/chrome
```

### Example Test (cosine.js)

```javascript
// tests/cosine.test.js
import { cosineSimilarity } from '../lib/cosine.js';

describe('cosineSimilarity', () => {
  test('identical vectors return 1.0', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });

  test('orthogonal vectors return 0.0', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
  });

  test('opposite vectors return -1.0', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([-1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
  });
});
```

### Example Test (tagValidator.js)

```javascript
// tests/tagValidator.test.js
import { validateTags } from '../utils/tagValidator.js';

describe('validateTags', () => {
  test('filters blacklisted tags', () => {
    const { tags } = validateTags(['misc', 'javascript', 'other'], 'Development');
    expect(tags).not.toContain('misc');
    expect(tags).not.toContain('other');
    expect(tags).toContain('javascript');
  });

  test('ensures minimum 3 tags', () => {
    const { tags } = validateTags(['js'], 'Development');
    expect(tags.length).toBeGreaterThanOrEqual(3);
  });

  test('validates category', () => {
    const { category } = validateTags([], 'InvalidCategory');
    expect(category).toBe('Reference');
  });
});
```

## Integration Testing

### Selenium WebDriver

Test the extension in a real browser:

```javascript
// tests/integration/popup.test.js
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

describe('Popup Integration', () => {
  let driver;

  beforeAll(async () => {
    const options = new chrome.Options();
    options.addArguments(`--load-extension=${path.resolve(__dirname, '../..')}`);
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  });

  afterAll(async () => {
    await driver.quit();
  });

  test('popup displays review tab', async () => {
    // Open popup and verify elements
    await driver.get('chrome-extension://YOUR_ID/build/popup/index.html');
    const reviewTab = await driver.findElement({ css: 'button:contains("Review")' });
    expect(await reviewTab.isDisplayed()).toBe(true);
  });
});
```

## Load Testing

### Test with Large Bookmark Libraries

1. **Generate test data**:
   ```javascript
   // tests/fixtures/generateBookmarks.js
   async function createTestBookmarks(count) {
     for (let i = 0; i < count; i++) {
       await chrome.bookmarks.create({
         parentId: '1',
         title: `Test Bookmark ${i}`,
         url: `https://example.com/page-${i}`
       });
     }
   }
   ```

2. **Measure performance**:
   - Time to embed 1,000 bookmarks
   - Time to detect duplicates
   - Memory usage during processing

3. **Monitor quotas**:
   - `chrome.storage.sync.getBytesInUse()`
   - `chrome.storage.local.getBytesInUse()`

## API Mocking

For testing without Azure OpenAI costs:

```javascript
// tests/mocks/openaiMock.js
export function createMockOpenAI() {
  return {
    async chat(messages) {
      return {
        choices: [{
          message: {
            content: JSON.stringify([
              { tags: ['test', 'mock', 'example'], category: 'Development' }
            ])
          }
        }]
      };
    },
    async embed(text) {
      // Return random embedding
      const vec = new Float32Array(1536);
      for (let i = 0; i < 1536; i++) {
        vec[i] = Math.random();
      }
      return { data: [{ embedding: Array.from(vec) }] };
    }
  };
}
```

## Continuous Testing

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Extension

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd popup && npm install
      - run: cd popup && npm run build
      - run: npm test # If you add jest tests
```

## Edge-Specific Testing

- Test on **Edge Canary** for latest APIs
- Verify no Chrome-only APIs are used
- Test on Windows, macOS, and Linux
- Check compatibility with Edge Workspaces

## Debugging Tips

### Service Worker Console
`edge://extensions` → Service Worker → **Inspect**

### Offscreen Document Console
Open DevTools → Sources → Content Scripts → Select offscreen.html

### Storage Inspection
DevTools → Application → Storage → Chrome Extension

### Network Inspection
DevTools → Network (check Azure OpenAI requests)

## Test Data Cleanup

After testing:
```javascript
// Clear all test bookmarks
const tree = await chrome.bookmarks.getTree();
// Recursively delete test nodes
```

## Reporting Issues

When filing bugs, include:
1. Edge version
2. Extension version
3. Steps to reproduce
4. Console errors (service worker + offscreen)
5. Network errors (if API-related)
