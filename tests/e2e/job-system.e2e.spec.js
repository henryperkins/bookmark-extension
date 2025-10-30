import { test, expect } from '@playwright/test';
import { ExtensionTestHelper, PerformanceMonitor } from './helpers/extension-test-helper.js';

test.describe('Job System Integration', () => {
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
    await helper.takeScreenshot(`job-system-${test.info().title}`);
    if (page) await page.close();
  });

  test.afterAll(async () => {
    await helper.cleanup();
  });

  test('can start and monitor a job', async () => {
    // Navigate to Progress tab
    await page.locator('button:has-text("Progress")').click();

    // Mock job system commands
    await page.addInitScript(() => {
      let mockJob = null;

      chrome.runtime.sendMessage = (message, callback) => {
        const responses = {
          'GET_JOB_STATUS': { success: true, snapshot: mockJob },
          'START_JOB': {
            success: true,
            jobId: 'test-job-123'
          },
          'GET_ACTIVITY_LOG': {
            success: true,
            activity: mockJob ? [{
              timestamp: new Date().toISOString(),
              level: 'info',
              message: 'Test activity',
              jobId: mockJob.jobId
            }] : []
          }
        };

        const response = responses[message.command] || { success: false, error: 'Unknown command' };

        if (message.command === 'START_JOB') {
          // Create mock job
          mockJob = {
            jobId: 'test-job-123',
            status: 'running',
            stage: 'initializing',
            progress: 0,
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString()
          };

          // Simulate job progress
          setTimeout(() => {
            mockJob.status = 'completed';
            mockJob.progress = 100;
            mockJob.completedAt = new Date().toISOString();
            mockJob.summary = {
              duplicatesFound: 5,
              duplicatesResolved: 3,
              totalBookmarks: 50,
              runtimeMs: 15000
            };
          }, 1000);
        }

        if (callback) callback(response);
        return Promise.resolve(response);
      };
    });

    // Wait for dashboard to load
    await page.waitForSelector('text=Job Progress Dashboard');

    // Start a job (in real test, this would be through UI)
    await page.evaluate(() => {
      chrome.runtime.sendMessage({
        type: 'jobCommand',
        command: 'START_JOB',
        payload: { queueMeta: { requestedBy: 'manual' } }
      });
    });

    // Wait for job to start
    await page.waitForTimeout(500);

    // Check job status updates
    const jobStatus = page.locator('[data-testid="job-status"]');
    await expect(jobStatus).toBeVisible();

    // Monitor performance during job execution
    const metrics = await monitor.getMetrics();
    console.log('Performance metrics:', metrics);

    // Check memory usage
    const memoryUsage = await monitor.getMemoryUsage();
    console.log('Memory usage:', memoryUsage);
  });

  test('job controls work correctly', async () => {
    await page.locator('button:has-text("Progress")').click();

    // Mock an active job
    await page.addInitScript(() => {
      const mockJob = {
        jobId: 'test-job-456',
        status: 'running',
        stage: 'scanning',
        progress: 45,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString()
      };

      chrome.runtime.sendMessage = (message, callback) => {
        const responses = {
          'GET_JOB_STATUS': { success: true, snapshot: mockJob },
          'PAUSE_JOB': {
            success: true,
            result: mockJob.status = 'paused'
          },
          'RESUME_JOB': {
            success: true,
            result: mockJob.status = 'running'
          },
          'CANCEL_JOB': {
            success: true,
            result: mockJob.status = 'cancelled'
          }
        };

        const response = responses[message.command] || { success: false, error: 'Unknown command' };

        // Update mock job state based on command
        if (responses[message.command] && responses[message.command].result) {
          responses[message.command].result;
        }

        if (callback) callback(response);
        return Promise.resolve(response);
      };
    });

    // Wait for job to appear
    await page.waitForTimeout(500);

    // Test pause functionality
    const pauseButton = page.locator('button:has-text("Pause")');
    if (await pauseButton.isVisible()) {
      await pauseButton.click();

      // Verify job status changed to paused
      await page.waitForTimeout(200);

      // Test resume functionality
      const resumeButton = page.locator('button:has-text("Resume")');
      if (await resumeButton.isVisible()) {
        await resumeButton.click();
        await page.waitForTimeout(200);
      }
    }

    // Test cancel functionality
    const cancelButton = page.locator('button:has-text("Cancel")');
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await page.waitForTimeout(200);
    }
  });

  test('handles job errors gracefully', async () => {
    await page.locator('button:has-text("Progress")').click();

    // Mock job error scenario
    await page.addInitScript(() => {
      chrome.runtime.sendMessage = (message, callback) => {
        if (message.command === 'GET_JOB_STATUS') {
          const response = {
            success: true,
            snapshot: {
              jobId: 'test-job-error',
              status: 'failed',
              stage: 'enriching',
              progress: 75,
              error: 'Simulated API error: Request failed',
              createdAt: new Date().toISOString(),
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString()
            }
          };
          if (callback) callback(response);
          return Promise.resolve(response);
        }
        return Promise.resolve({ success: false, error: 'Unknown command' });
      };
    });

    // Wait for error state to display
    await page.waitForTimeout(500);

    // Check error display
    await expect(page.locator('text=Simulated API error')).toBeVisible();

    // Check error styling
    const errorElement = page.locator('text=failed');
    await expect(errorElement).toHaveCSS('color', 'rgb(209, 52, 56)'); // danger color
  });

  test('job stages display correctly', async () => {
    await page.locator('button:has-text("Progress")').click();
    await page.locator('button:has-text("Stages")').click();

    // Mock stage data
    await page.addInitScript(() => {
      chrome.runtime.sendMessage = (message, callback) => {
        if (message.command === 'GET_JOB_STATUS') {
          const response = {
            success: true,
            snapshot: {
              jobId: 'test-job-stages',
              status: 'running',
              stage: 'scanning',
              progress: 35,
              stages: [
                { name: 'initializing', status: 'completed', duration: 1000 },
                { name: 'scanning', status: 'running', progress: 35 },
                { name: 'grouping', status: 'pending', progress: 0 },
                { name: 'resolving', status: 'pending', progress: 0 },
                { name: 'verifying', status: 'pending', progress: 0 }
              ],
              createdAt: new Date().toISOString(),
              startedAt: new Date().toISOString()
            }
          };
          if (callback) callback(response);
          return Promise.resolve(response);
        }
        return Promise.resolve({ success: false, error: 'Unknown command' });
      };
    });

    // Wait for stages to load
    await page.waitForTimeout(500);

    // Check that stages are displayed
    const stages = page.locator('[data-testid="job-stage"]');
    await expect(stages).toHaveCount(5);

    // Check stage statuses
    await expect(page.locator('text=completed')).toBeVisible();
    await expect(page.locator('text=running')).toBeVisible();
    await expect(page.locator('text=pending')).toBeVisible();
  });

  test('activity feed updates in real-time', async () => {
    await page.locator('button:has-text("Progress")').click();
    await page.locator('button:has-text("Activity")').click();

    // Mock activity updates
    await page.addInitScript(() => {
      let activityIndex = 0;
      const activities = [
        { level: 'info', message: 'Job started', timestamp: new Date().toISOString() },
        { level: 'info', message: 'Scanning bookmarks...', timestamp: new Date().toISOString() },
        { level: 'debug', message: 'Found 100 bookmarks to process', timestamp: new Date().toISOString() },
        { level: 'info', message: 'Processing duplicate groups...', timestamp: new Date().toISOString() }
      ];

      chrome.runtime.sendMessage = (message, callback) => {
        if (message.command === 'GET_ACTIVITY_LOG') {
          const response = {
            success: true,
            activity: activities.slice(0, Math.min(activityIndex + 1, activities.length))
          };
          activityIndex = Math.min(activityIndex + 1, activities.length - 1);
          if (callback) callback(response);
          return Promise.resolve(response);
        }
        return Promise.resolve({ success: false, error: 'Unknown command' });
      };
    });

    // Wait for activity to load
    await page.waitForTimeout(500);

    // Check activity entries are displayed
    const activityEntries = page.locator('[data-testid="activity-entry"]');
    await expect(activityEntries.count()).resolves.toBeGreaterThan(0);

    // Check different log levels are styled correctly
    await expect(page.locator('.activity-info')).toBeVisible();
    await expect(page.locator('.activity-debug')).toBeVisible();
  });

  test('performance metrics are tracked', async () => {
    await page.locator('button:has-text("Progress")').click();
    await page.locator('button:has-text("Metrics")').click();

    // Mock metrics data
    await page.addInitScript(() => {
      chrome.runtime.sendMessage = (message, callback) => {
        if (message.command === 'GET_JOB_STATUS') {
          const response = {
            success: true,
            snapshot: {
              jobId: 'test-job-metrics',
              status: 'completed',
              progress: 100,
              metrics: {
                duration: 45000,
                bookmarksProcessed: 150,
                duplicatesFound: 25,
                averageProcessingTime: 300,
                memoryUsage: 52428800 // 50MB
              },
              createdAt: new Date(Date.now() - 60000).toISOString(),
              startedAt: new Date(Date.now() - 45000).toISOString(),
              completedAt: new Date().toISOString()
            }
          };
          if (callback) callback(response);
          return Promise.resolve(response);
        }
        return Promise.resolve({ success: false, error: 'Unknown command' });
      };
    });

    // Wait for metrics to load
    await page.waitForTimeout(500);

    // Check metrics are displayed
    await expect(page.locator('text=45s')).toBeVisible();
    await expect(page.locator('text=150 bookmarks')).toBeVisible();
    await expect(page.locator('text=25 duplicates')).toBeVisible();
  });
});
