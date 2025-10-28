export class NotificationManager {
  constructor() {
    this.id = 'bookmark-progress';
    this.created = false;
  }

  async ensureProgress(message = 'Starting...') {
    if (this.created) return;
    try {
      await chrome.notifications.create(this.id, {
        type: 'progress',
        iconUrl: '/icons/icon128.png',
        title: 'Bookmark Cleaner',
        message,
        progress: 0
      });
      this.created = true;

      // Persist initial, indeterminate job snapshot for popup UI
      try {
        await chrome.storage.local.set({
          dedupeJob: {
            jobId: this.id,
            status: 'running',
            stage: 'initializing',
            stageIndex: 0,
            totalUnits: 0,
            processedUnits: 0,
            stagePercent: 0,
            weightedPercent: 0.05, // 5% initializing
            indeterminate: true,
            activity: message,
            timestamp: new Date().toISOString()
          }
        });
      } catch {
        // ignore storage failures
      }
    } catch (e) {
      console.warn('Failed to create progress notification:', e);
    }
  }

  async showProgress(current, total, message) {
    if (!this.created) await this.ensureProgress(message);
    const progress = total ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
    try {
      await chrome.notifications.update(this.id, { message, progress });
    } catch (e) {
      console.warn('Failed to update progress notification:', e);
    }

    // Persist scanning-stage snapshot for popup UI
    try {
      const stagePercentVal = total ? Math.max(0, Math.min(1, current / Math.max(1, total))) : 0;
      const weightedPercent = Math.max(0, Math.min(1, 0.05 + 0.30 * stagePercentVal)); // 5% init + 30% scanning
      await chrome.storage.local.set({
        dedupeJob: {
          jobId: this.id,
          status: 'running',
          stage: 'scanning',
          stageIndex: 1,
          totalUnits: total || 0,
          processedUnits: current || 0,
          stagePercent: stagePercentVal,
          weightedPercent,
          indeterminate: !total,
          activity: message,
          timestamp: new Date().toISOString()
        }
      });
    } catch {
      // ignore storage failures
    }
  }

  async showComplete(stats) {
    if (this.created) {
      try {
        await chrome.notifications.clear(this.id);
      } catch (e) {
        console.warn('Failed to clear progress notification:', e);
      }
      this.created = false;
    }

    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        title: 'Cleanup Complete',
        message: `Processed ${stats.total} bookmarks. Found ${stats.duplicates} duplicates.`
      });
    } catch (e) {
      console.warn('Failed to create completion notification:', e);
    }

    // Persist terminal snapshot for popup summary
    try {
      await chrome.storage.local.set({
        dedupeJob: {
          jobId: this.id,
          status: 'completed',
          stage: 'summarizing',
          stageIndex: 5,
          totalUnits: stats?.total || 0,
          processedUnits: stats?.total || 0,
          stagePercent: 1,
          weightedPercent: 1,
          indeterminate: false,
          activity: `Processed ${stats.total} bookmarks. Found ${stats.duplicates} duplicates.`,
          timestamp: new Date().toISOString(),
          summary: stats || null
        }
      });
    } catch {
      // ignore storage failures
    }
  }

  async showError(message) {
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        title: 'Cleanup Error',
        message: String(message)
      });
    } catch (e) {
      console.warn('Failed to create error notification:', e);
    }

    try {
      await chrome.storage.local.set({
        dedupeJob: {
          jobId: this.id,
          status: 'failed',
          stage: 'failed',
          stageIndex: -1,
          totalUnits: 0,
          processedUnits: 0,
          stagePercent: 0,
          weightedPercent: 0,
          indeterminate: false,
          activity: `Error: ${String(message)}`,
          timestamp: new Date().toISOString()
        }
      });
    } catch {
      // ignore storage failures
    }
  }
}