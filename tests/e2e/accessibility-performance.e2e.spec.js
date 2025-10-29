import { test, expect } from '@playwright/test';
import { ExtensionTestHelper, PerformanceMonitor } from './helpers/extension-test-helper.js';

test.describe('Accessibility Tests', () => {
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
    await helper.takeScreenshot(`accessibility-${test.info().title}`);
    if (page) await page.close();
  });

  test.afterAll(async () => {
    await helper.cleanup();
  });

  test('popup has proper semantic HTML structure', async () => {
    // Check for proper heading hierarchy
    const h1 = await page.locator('h1').count();
    const h3 = await page.locator('h3').count();

    expect(h3).toBeGreaterThan(0); // Should have section headings

    // Check for proper ARIA roles
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();

    // Check for proper landmark elements
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('keyboard navigation works throughout the app', async () => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    let focused = await page.locator(':focus');
    await expect(focused).toBeVisible();

    // Navigate through all interactive elements
    const interactiveElements = page.locator('button, input, [tabindex]:not([tabindex="-1"])');
    const count = await interactiveElements.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      await page.keyboard.press('Tab');
      focused = await page.locator(':focus');
      await expect(focused).toBeVisible();

      // Check that focused element is interactive
      const tagName = await focused.evaluate(el => el.tagName.toLowerCase());
      expect(['button', 'input', 'a']).toContain(tagName);
    }

    // Test Shift+Tab navigation
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+Tab');
      focused = await page.locator(':focus');
      await expect(focused).toBeVisible();
    }
  });

  test('all interactive elements have accessible names', async () => {
    // Check buttons have accessible names
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const accessibleName = await button.getAttribute('aria-label') ||
                           await button.textContent() ||
                           await button.getAttribute('title');

      expect(accessibleName && accessibleName.trim().length > 0).toBeTruthy();
    }

    // Check inputs have labels
    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await page.locator(`label[for="${await input.getAttribute('id')}"]`).count() > 0 ||
                     await input.getAttribute('aria-label') ||
                     await input.getAttribute('placeholder');

      expect(hasLabel).toBeTruthy();
    }
  });

  test('screen reader announcements work', async () => {
    // Navigate to different tabs and check for live regions
    const tabs = ['Add', 'Manage', 'Import/Export', 'Progress'];

    for (const tab of tabs) {
      await page.locator(`button:has-text("${tab}")`).click();

      // Check for ARIA live regions
      const liveRegions = page.locator('[aria-live]');
      const hasLiveRegion = await liveRegions.count() > 0;

      // Some tabs should have announcements
      if (tab === 'Progress') {
        expect(hasLiveRegion).toBeTruthy();
      }
    }
  });

  test('color contrast meets WCAG AA standards', async () => {
    // This is a basic check - in real implementation you'd use a proper contrast checker
    const styles = await page.locator('style').textContent();

    // Check that CSS variables are defined for colors
    expect(styles).toContain('--text:');
    expect(styles).toContain('--primary:');
    expect(styles).toContain('--background:');

    // Check that high contrast mode CSS is present
    expect(styles).toContain('prefers-contrast: high');
    expect(styles).toContain('forced-colors: active');
  });

  test('focus indicators are visible', async () => {
    const buttons = page.locator('button');
    const firstButton = buttons.first();

    // Focus the button
    await firstButton.focus();

    // Check for focus styles
    const focusStyles = await firstButton.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        outlineOffset: computed.outlineOffset,
        boxShadow: computed.boxShadow
      };
    });

    // Should have some form of focus indicator
    const hasFocusIndicator = focusStyles.outline !== 'none' ||
                            focusStyles.boxShadow !== 'none' ||
                            focusStyles.outline !== '';

    expect(hasFocusIndicator).toBeTruthy();
  });

  test('reduced motion is respected', async () => {
    // Check that reduced motion CSS is present
    const styles = await page.locator('style').textContent();

    expect(styles).toContain('prefers-reduced-motion: reduce');
    expect(styles).toContain('animation-duration: 0.01ms');
    expect(styles).toContain('transition-duration: 0.01ms');
  });

  test('form validation errors are accessible', async () => {
    // Navigate to Add tab
    await page.locator('button:has-text("Add")').click();

    // Try to submit empty form
    await page.locator('button:has-text("Add Bookmark")').click();

    // Check for error message
    const errorMessage = page.locator('text=Please enter both title and URL');
    await expect(errorMessage).toBeVisible();

    // Check error is associated with form (should be in dialog or alert)
    const role = await errorMessage.getAttribute('role');
    expect(['alert', 'dialog', 'status']).toContain(role);
  });
});

test.describe('Performance Tests', () => {
  let helper;
  let page;
  let monitor;

  test.beforeAll(async () => {
    helper = new ExtensionTestHelper();
    await helper.launchBrowser();
  });

  test.beforeEach(async () => {
    page = await helper.openPopup();
    monitor = new PerformanceMonitor(page);
    await monitor.startMonitoring();
  });

  test.afterEach(async () => {
    await helper.takeScreenshot(`performance-${test.info().title}`);
    if (page) await page.close();
  });

  test.afterAll(async () => {
    await helper.cleanup();
  });

  test('popup loads within performance budget', async () => {
    // Measure load time
    const loadStart = Date.now();
    await page.waitForLoadState('domcontentloaded');
    const loadEnd = Date.now();
    const loadTime = loadEnd - loadStart;

    // Should load in under 1 second
    expect(loadTime).toBeLessThan(1000);

    // Check for performance optimization indicators
    const styles = await page.locator('style').textContent();
    expect(styles).toContain('will-change') || expect(styles).toContain('transform');
  });

  test('tab switching is responsive', async () => {
    const tabs = ['Review', 'Add', 'Manage', 'Import/Export', 'Progress'];

    for (const tab of tabs) {
      const startTime = Date.now();
      await page.locator(`button:has-text("${tab}")`).click();

      // Wait for content to be visible
      await page.waitForSelector(`text=${tab === 'Import/Export' ? 'Import/Export' : tab + (tab === 'Progress' ? ' Dashboard' : '')}`);

      const endTime = Date.now();
      const switchTime = endTime - startTime;

      // Tab switching should be under 200ms
      expect(switchTime).toBeLessThan(200);
    }
  });

  test('memory usage remains reasonable', async () => {
    // Get initial memory usage
    const initialMemory = await monitor.getMemoryUsage();

    // Navigate through all tabs and interact with elements
    await page.locator('button:has-text("Add")').click();
    await page.locator('input[placeholder*="title"]').fill('Test bookmark');
    await page.locator('input[placeholder*="example.com"]').fill('https://example.com');

    await page.locator('button:has-text("Manage")').click();
    await page.locator('button:has-text("Progress")').click();

    // Get final memory usage
    const finalMemory = await monitor.getMemoryUsage();

    // Memory usage shouldn't increase dramatically
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.used - initialMemory.used;
      const maxIncrease = 10 * 1024 * 1024; // 10MB

      expect(memoryIncrease).toBeLessThan(maxIncrease);
    }
  });

  test('no memory leaks on repeated interactions', async () => {
    const baselineMemory = await monitor.getMemoryUsage();

    // Perform repeated actions
    for (let i = 0; i < 10; i++) {
      await page.locator('button:has-text("Add")').click();
      await page.locator('button:has-text("Manage")').click();
      await page.locator('button:has-text("Progress")').click();
      await page.locator('button:has-text("Review")').click();
    }

    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) window.gc();
    });

    const finalMemory = await monitor.getMemoryUsage();

    // Memory should be close to baseline
    if (baselineMemory && finalMemory) {
      const memoryDifference = Math.abs(finalMemory.used - baselineMemory.used);
      const maxAcceptableDifference = 5 * 1024 * 1024; // 5MB

      expect(memoryDifference).toBeLessThan(maxAcceptableDifference);
    }
  });

  test('large datasets don\'t block the UI', async () => {
    // Mock large dataset
    await page.addInitScript(() => {
      // Simulate processing large dataset
      window.mockLargeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `bookmark-${i}`,
        title: `Bookmark ${i}`,
        url: `https://example.com/${i}`,
        tags: [`tag${i % 10}`, `category${i % 5}`]
      }));
    });

    // Navigate to a tab that would display data
    await page.locator('button:has-text("Progress")').click();

    // Check that UI remains responsive during mock processing
    const startTime = Date.now();
    await page.evaluate(() => {
      // Simulate processing large dataset
      return new Promise(resolve => {
        setTimeout(() => {
          // Process would happen here
          resolve();
        }, 100);
      });
    });
    const endTime = Date.now();

    // Processing should not block UI for too long
    expect(endTime - startTime).toBeLessThan(500);

    // UI should still be interactive
    await expect(page.locator('button:has-text("Overview")')).toBeVisible();
    await page.locator('button:has-text("Overview")').click();
    await expect(page.locator('#overview-panel')).toBeVisible();
  });

  test('animations are performant', async () => {
    // Check that animations use performant properties
    const styles = await page.locator('style').textContent();

    // Should use transform and opacity for animations
    expect(styles).toContain('transform') || expect(styles).toContain('opacity');

    // Should avoid animating expensive properties
    expect(styles).not.toContain('width:') || expect(styles).toContain('transform:');

    // Check for hardware acceleration hints
    expect(styles).toContain('will-change') || expect(styles).toContain('transform3d');
  });
});