import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Helper class for testing Chrome extensions with Playwright
 */
export class ExtensionTestHelper {
  constructor() {
    this.context = null;
    this.page = null;
    this.extensionId = null;
    this.extensionPath = path.resolve(__dirname, '../../..');
  }

  /**
   * Launch browser with the extension loaded
   */
  async launchBrowser(options = {}) {
    const launchOptions = {
      headless: false, // Extension testing requires headed mode
      args: [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--force-color-profile=srgb',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      ...options
    };

    this.context = await chromium.launchPersistentContext('', launchOptions);

    // Wait for extension to load
    await this.waitForExtension();

    return this.context;
  }

  /**
   * Wait for extension to be loaded and get extension ID
   */
  async waitForExtension() {
    // Wait a bit for extension to load
    await this.context.waitForTimeout(2000);

    // Try to get extension ID from service worker
    const serviceWorkers = this.context.serviceWorkers();
    const extensionServiceWorker = serviceWorkers.find(sw =>
      sw.url().startsWith('chrome-extension://')
    );

    if (extensionServiceWorker) {
      const url = new URL(extensionServiceWorker.url());
      this.extensionId = url.hostname;
      console.log('Extension ID:', this.extensionId);
    }
  }

  /**
   * Open extension popup
   */
  async openPopup() {
    if (!this.extensionId) {
      throw new Error('Extension not loaded');
    }

    const popupUrl = `chrome-extension://${this.extensionId}/build/popup/index.html`;
    this.page = await this.context.newPage();
    await this.page.goto(popupUrl);

    // Wait for popup to load
    await this.page.waitForLoadState('domcontentloaded');

    return this.page;
  }

  /**
   * Open extension options page
   */
  async openOptions() {
    if (!this.extensionId) {
      throw new Error('Extension not loaded');
    }

    const optionsUrl = `chrome-extension://${this.extensionId}/options/index.html`;
    this.page = await this.context.newPage();
    await this.page.goto(optionsUrl);

    await this.page.waitForLoadState('domcontentloaded');

    return this.page;
  }

  /**
   * Mock Chrome APIs for testing
   */
  async mockChromeAPIs() {
    await this.page.addInitScript(() => {
      // Mock chrome.storage.local
      globalThis.chrome = globalThis.chrome || {};
      globalThis.chrome.storage = {
        local: {
          get: (keys, callback) => {
            const result = {};
            if (callback) callback(result);
            return Promise.resolve(result);
          },
          set: (items, callback) => {
            if (callback) callback();
            return Promise.resolve();
          },
          remove: (keys, callback) => {
            if (callback) callback();
            return Promise.resolve();
          },
          clear: (callback) => {
            if (callback) callback();
            return Promise.resolve();
          }
        },
        sync: {
          get: (keys, callback) => {
            const result = {};
            if (callback) callback(result);
            return Promise.resolve(result);
          },
          set: (items, callback) => {
            if (callback) callback();
            return Promise.resolve();
          }
        }
      };

      // Mock chrome.bookmarks
      globalThis.chrome.bookmarks = {
        getTree: () => Promise.resolve([]),
        create: (bookmark) => Promise.resolve({ id: 'mock-id', ...bookmark }),
        update: (id, changes) => Promise.resolve({ id, ...changes }),
        remove: (id) => Promise.resolve(),
        search: (query) => Promise.resolve([]),
        getChildren: (id) => Promise.resolve([])
      };

      // Mock chrome.runtime
      globalThis.chrome.runtime = {
        sendMessage: (message, callback) => {
          const response = { success: true, data: null };
          if (callback) callback(response);
          return Promise.resolve(response);
        },
        id: 'test-extension-id'
      };
    });
  }

  /**
   * Create test bookmarks
   */
  async createTestBookmarks(bookmarks) {
    for (const bookmark of bookmarks) {
      await this.page.evaluate((bm) => {
        return new Promise((resolve) => {
          chrome.bookmarks.create(bm, resolve);
        });
      }, bookmark);
    }
  }

  /**
   * Clear all test data
   */
  async clearTestData() {
    await this.page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.bookmarks.getTree((tree) => {
          const removeBookmarks = (nodes) => {
            for (const node of nodes) {
              if (node.url) {
                chrome.bookmarks.remove(node.id);
              } else if (node.children) {
                removeBookmarks(node.children);
              }
            }
          };
          removeBookmarks(tree);
          resolve();
        });
      });
    });
  }

  /**
   * Take screenshot with filename
   */
  async takeScreenshot(name) {
    const screenshotPath = path.resolve(__dirname, `../screenshots/${name}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  /**
   * Wait for job to complete
   */
  async waitForJobCompletion(timeout = 60000) {
    await this.page.waitForFunction(() => {
      return document.querySelector('[data-testid="job-status"]')?.textContent?.includes('completed');
    }, { timeout });
  }

  /**
   * Get console logs for debugging
   */
  getConsoleLogs() {
    const logs = [];
    this.page.on('console', msg => {
      logs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });
    return logs;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.page) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
  }
}

/**
 * Performance monitoring helper
 */
export class PerformanceMonitor {
  constructor(page) {
    this.page = page;
    this.metrics = [];
  }

  async startMonitoring() {
    // Enable performance monitoring
    await this.page.addInitScript(() => {
      window.performanceMetrics = [];

      // Override fetch to monitor API calls
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const start = performance.now();
        try {
          const response = await originalFetch.apply(window, args);
          const end = performance.now();
          window.performanceMetrics.push({
            type: 'fetch',
            url: args[0],
            duration: end - start,
            status: response.status
          });
          return response;
        } catch (error) {
          const end = performance.now();
          window.performanceMetrics.push({
            type: 'fetch',
            url: args[0],
            duration: end - start,
            error: error.message
          });
          throw error;
        }
      };
    });
  }

  async getMetrics() {
    return await this.page.evaluate(() => window.performanceMetrics || []);
  }

  async getMemoryUsage() {
    const memory = await this.page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    return memory;
  }
}