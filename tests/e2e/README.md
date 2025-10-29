# End-to-End Testing with Playwright

This directory contains comprehensive E2E tests for the bookmark extension using Playwright.

## Setup

1. **Install dependencies**:
```bash
cd tests/e2e
npm install
```

2. **Install Playwright browsers**:
```bash
npm run install:browsers
```

3. **Build the extension**:
```bash
cd ../..
# Build popup
cd popup && npm run build && cd ..
# Build extension (if needed)
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in headed mode (useful for debugging)
```bash
npm run test:headed
```

### Run tests with Playwright UI
```bash
npm run test:ui
```

### Debug tests
```bash
npm run test:debug
```

### View test report
```bash
npm run test:report
```

## Test Categories

### 1. UI Tests (`popup-ui.e2e.spec.js`)
- Popup loads and displays all tabs
- Tab navigation works correctly
- Add Bookmark form functionality
- Empty states display correctly
- Accessibility features
- Responsive design

### 2. Job System Tests (`job-system.e2e.spec.js`)
- Start and monitor jobs
- Job controls (pause, resume, cancel)
- Error handling
- Stage progression
- Activity feed updates
- Performance metrics

### 3. Accessibility & Performance Tests (`accessibility-performance.e2e.spec.js`)
- Semantic HTML structure
- Keyboard navigation
- Screen reader support
- Color contrast
- Focus indicators
- Performance budgets
- Memory leak detection

## Test Configuration

The `playwright.config.js` file configures:

- **Browsers**: Microsoft Edge, Chromium, Firefox
- **Viewports**: Desktop and mobile
- **Reporting**: HTML reports with screenshots
- **Timeouts**: Configured for extension testing
- **Screenshots**: Taken on failure
- **Videos**: Recorded on failure

## Extension Testing Helper

The `ExtensionTestHelper` class provides:

- Browser launching with extension loading
- Popup and options page opening
- Chrome API mocking
- Test bookmark creation/cleanup
- Screenshot capture
- Performance monitoring

## Writing New Tests

### Basic Test Structure

```javascript
import { test, expect } from '@playwright/test';
import { ExtensionTestHelper } from './helpers/extension-test-helper.js';

test.describe('Feature Name', () => {
  let helper;
  let page;

  test.beforeAll(async () => {
    helper = new ExtensionTestHelper();
    await helper.launchBrowser();
  });

  test.beforeEach(async () => {
    page = await helper.openPopup();
  });

  test.afterEach(async () => {
    await helper.takeScreenshot(`feature-${test.info().title}`);
    if (page) await page.close();
  });

  test.afterAll(async () => {
    await helper.cleanup();
  });

  test('specific functionality', async () => {
    // Test implementation
    await page.locator('button:has-text("Click me")').click();
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

### Mocking Chrome APIs

```javascript
await page.addInitScript(() => {
  chrome.runtime.sendMessage = (message, callback) => {
    // Mock response based on message.command
    const response = { success: true, data: 'mock data' };
    if (callback) callback(response);
    return Promise.resolve(response);
  };
});
```

### Performance Monitoring

```javascript
import { PerformanceMonitor } from './helpers/extension-test-helper.js';

test.beforeEach(async () => {
  const monitor = new PerformanceMonitor(page);
  await monitor.startMonitoring();
});

test.afterEach(async () => {
  const metrics = await monitor.getMetrics();
  console.log('Performance metrics:', metrics);

  const memory = await monitor.getMemoryUsage();
  console.log('Memory usage:', memory);
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          cd tests/e2e && npm install

      - name: Install Playwright browsers
        run: cd tests/e2e && npm run install:browsers

      - name: Build extension
        run: |
          cd popup && npm run build && cd ..

      - name: Run E2E tests
        run: cd tests/e2e && npm test

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: tests/e2e/playwright-report/
```

## Debugging Tips

### Screenshots
Screenshots are automatically taken on failure and saved to `tests/e2e/screenshots/`.

### Console Logs
```javascript
page.on('console', msg => {
  console.log(msg.type(), msg.text());
});
```

### Network Monitoring
```javascript
page.on('request', request => {
  console.log('Request:', request.url());
});
```

### Video Recording
Videos are recorded for failed tests and available in the HTML report.

### Slow Motion
Add `slowMo: 100` to browser launch options for slow-motion execution.

## Accessibility Testing

The tests include:

- **Semantic HTML**: Proper heading hierarchy and landmarks
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader**: ARIA labels and live regions
- **Color Contrast**: WCAG AA compliance
- **Focus Management**: Visible focus indicators

## Performance Testing

Performance tests verify:

- **Load Times**: Under 1 second for popup
- **Tab Switching**: Under 200ms
- **Memory Usage**: No excessive memory growth
- **Animation Performance**: 60fps animations
- **Large Datasets**: UI responsiveness with data

## Troubleshooting

### Extension Not Loading
1. Ensure the extension is built: `cd popup && npm run build`
2. Check extension path in helper
3. Verify manifest.json is valid

### Tests Failing Intermittently
1. Increase timeouts in playwright.config.js
2. Add explicit waits for async operations
3. Check for race conditions in test setup

### Browser Issues
1. Update Playwright: `npm install @playwright/test@latest`
2. Reinstall browsers: `npm run install:browsers`
3. Try different browser channels

### Chrome API Issues
1. Ensure proper mocking in tests
2. Check API permissions in manifest.json
3. Verify extension context is available

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Wait Strategies**: Use explicit waits over fixed timeouts
4. **Assertions**: Be specific with expectations
5. **Accessibility**: Test with keyboard and screen readers
6. **Performance**: Monitor memory and timing
7. **Documentation**: Comment complex test scenarios
8. **Error Messages**: Provide clear failure messages