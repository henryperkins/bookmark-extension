import { test, expect } from '@playwright/test';
import { ExtensionTestHelper, PerformanceMonitor } from './helpers/extension-test-helper.js';

test.describe('Extension Popup UI', () => {
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
    await helper.takeScreenshot(`popup-ui-${test.info().title}`);
    if (page) await page.close();
  });

  test.afterAll(async () => {
    await helper.cleanup();
  });

  test('popup loads and displays all tabs', async () => {
    // Check that popup loads
    await expect(page).toHaveTitle(/Bookmark Extension/);

    // Check all tabs are present
    const tabs = ['Review', 'Add', 'Manage', 'Import/Export', 'Progress'];
    for (const tabText of tabs) {
      await expect(page.locator(`button:has-text("${tabText}")`)).toBeVisible();
    }

    // Check Review tab is active by default
    const reviewTab = page.locator('button:has-text("Review")');
    await expect(reviewTab).toHaveAttribute('aria-selected', 'true');
  });

  test('tab navigation works correctly', async () => {
    const tabs = [
      { name: 'Add', content: 'Add Bookmark' },
      { name: 'Manage', content: 'Manage Bookmarks' },
      { name: 'Import/Export', content: 'Import/Export' },
      { name: 'Progress', content: 'Job Progress Dashboard' }
    ];

    for (const tab of tabs) {
      // Click tab
      await page.locator(`button:has-text("${tab.name}")`).click();

      // Check tab becomes active
      await expect(page.locator(`button:has-text("${tab.name}")`)).toHaveAttribute('aria-selected', 'true');

      // Check content is visible
      await expect(page.locator(`text=${tab.content}`)).toBeVisible();

      // Check for accessibility announcement
      const announcement = await page.locator('[aria-live]').textContent();
      expect(announcement).toContain('Button focused');
    }
  });

  test('Add Bookmark form works', async () => {
    // Navigate to Add tab
    await page.locator('button:has-text("Add")').click();

    // Fill in form
    await page.locator('input[placeholder*="title"]').fill('Test Bookmark');
    await page.locator('input[placeholder*="example.com"]').fill('https://example.com/test');
    await page.locator('input[placeholder*="Folder ID"]').fill('1');

    // Mock the Chrome APIs since we're in test environment
    await helper.mockChromeAPIs();

    // Submit form
    await page.locator('button:has-text("Add Bookmark")').click();

    // Check for success message (this would normally come from Chrome API response)
    // In a real test, you'd mock the chrome.runtime.sendMessage response
  });

  test('displays empty states correctly', async () => {
    // Review queue should show empty state
    await expect(page.locator('text=No duplicates pending review')).toBeVisible();

    // Manage bookmarks should show empty tree
    await page.locator('button:has-text("Manage")').click();
    await expect(page.locator('text=Manage Bookmarks')).toBeVisible();
  });

  test('accessibility features work', async () => {
    // Check keyboard navigation
    await page.keyboard.press('Tab');
    let focused = await page.locator(':focus');
    await expect(focused).toBeVisible();

    // Navigate through tabs with arrow keys
    const firstTab = page.locator('button:has-text("Review")');
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');

    // Check focus moved to next tab
    focused = await page.locator(':focus');
    const nextTabText = await focused.textContent();
    expect(['Add', 'Manage', 'Import/Export', 'Progress']).toContain(nextTabText);

    // Check ARIA labels are present
    const navigation = page.locator('[role="tablist"]');
    await expect(navigation).toHaveAttribute('aria-label');
  });

  test('reduced motion support', async () => {
    // Check that reduced motion CSS is present
    const styles = await page.locator('style').textContent();
    expect(styles).toContain('prefers-reduced-motion');
  });

  test('responsive design on different viewport sizes', async () => {
    const viewports = [
      { width: 800, height: 600 },
      { width: 400, height: 600 },
      { width: 1200, height: 800 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      // Check content is still accessible
      await expect(page.locator('button:has-text("Review")')).toBeVisible();
      await expect(page.locator('button:has-text("Add")')).toBeVisible();
    }
  });
});

test.describe('Job Progress and History', () => {
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
    if (page) await page.close();
  });

  test.afterAll(async () => {
    await helper.cleanup();
  });

  test('Progress tab shows job dashboard', async () => {
    // Navigate to Progress tab
    await page.locator('button:has-text("Progress")').click();

    // Check dashboard elements are present
    await expect(page.locator('text=Job Progress Dashboard')).toBeVisible();

    // Check dashboard view tabs
    const viewTabs = ['Overview', 'Stages', 'Activity', 'Metrics', 'History'];
    for (const tab of viewTabs) {
      await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
    }
  });

  test('History view loads and displays correctly', async () => {
    // Navigate to Progress tab then History
    await page.locator('button:has-text("Progress")').click();
    await page.locator('button:has-text("History")').click();

    // Check history panel is visible
    await expect(page.locator('#history-panel')).toBeVisible();

    // Should show loading state initially
    await expect(page.locator('text=Loading job history')).toBeVisible();

    // Check refresh button is present
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();

    // In a real test with data, you'd check for history entries
  });

  test('Export functionality in history', async () => {
    await page.locator('button:has-text("Progress")').click();
    await page.locator('button:has-text("History")').click();

    // Mock having a job in history
    await page.evaluate(() => {
      // Mock a job history entry
      window.mockJobHistory = [{
        jobId: 'test-job-123',
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        summary: {
          duplicatesFound: 5,
          duplicatesResolved: 3,
          totalBookmarks: 100,
          runtimeMs: 30000
        }
      }];
    });

    // Mock the chrome.runtime.sendMessage for GET_JOB_HISTORY
    await page.addInitScript(() => {
      const originalSendMessage = chrome.runtime.sendMessage;
      chrome.runtime.sendMessage = (message, callback) => {
        if (message.command === 'GET_JOB_HISTORY') {
          const response = { success: true, history: window.mockJobHistory || [] };
          if (callback) callback(response);
          return Promise.resolve(response);
        }
        return originalSendMessage.call(chrome.runtime, message, callback);
      };
    });

    // Click refresh to load history
    await page.locator('button:has-text("Refresh")').click();

    // Wait for history to load
    await page.waitForTimeout(1000);

    // Check export buttons appear when there's history
    const exportButtons = page.locator('button:has-text("JSON"), button:has-text("CSV"), button:has-text("TXT")');
    await expect(exportButtons).toHaveCount(3);
  });
});