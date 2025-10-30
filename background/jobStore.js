/**
 * Job Store - Persistence Layer
 * Handles durable storage of job state, activity logs, and queue data
 * Implements quota-aware operations and migration support
 */


const DEFAULT_STORE_OPTIONS = {
  maxActivityEntries: 100,
  maxQueueHistory: 10,
  debounceDelay: 500,
  retryAttempts: 3,
  retryDelay: 1000,
  enableCompression: false
};

export class JobStore {
  constructor(options = {}) {
    this.options = { ...DEFAULT_STORE_OPTIONS, ...options };
    this.saveQueue = new Map();
    this.lastSave = new Map();

    this.KEYS = {
      SNAPSHOT: 'jobSnapshot',
      ACTIVITY: 'jobActivity',
      QUEUE: 'jobQueue',
      HISTORY: 'jobHistory',
      MIGRATION: 'jobStoreMigration'
    };
  }

  /**
   * Load the current job snapshot
   */
  async loadSnapshot() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.SNAPSHOT);
      const snapshotData = result[this.KEYS.SNAPSHOT];

      if (!snapshotData) {
        return null;
      }

      // Validate snapshot structure
      if (this.isValidSnapshot(snapshotData)) {
        return snapshotData;
      } else {
        console.warn('Invalid snapshot data found, clearing');
        await this.clearSnapshot();
        return null;
      }
    } catch (error) {
      console.error('Failed to load job snapshot:', error);
      return null;
    }
  }

  /**
   * Save the current job snapshot
   */
  async saveSnapshot(snapshot) {
    if (!this.isValidSnapshot(snapshot)) {
      throw new Error('Invalid snapshot data');
    }

    const key = this.KEYS.SNAPSHOT;
    const lastSaveTime = this.lastSave.get(key) || 0;
    const now = Date.now();

    // Check if we need to debounce, but save immediately if paused
    const debounceDelay = Number.isFinite(this.options.debounceDelay) ? this.options.debounceDelay : DEFAULT_STORE_OPTIONS.debounceDelay;
    if (snapshot.status !== 'paused' && now - lastSaveTime < debounceDelay) {
      // Schedule deferred save
      this.scheduleSave(key, snapshot);
      return;
    }

    await this.performSave(key, snapshot);
    this.lastSave.set(key, now);
  }

  /**
   * Append activity entry to the log
   */
  async appendActivity(entry) {
    if (!this.isValidActivity(entry)) {
      throw new Error('Invalid activity entry');
    }

    try {
      // Load existing activity log
      const result = await chrome.storage.local.get(this.KEYS.ACTIVITY);
      const activities = result[this.KEYS.ACTIVITY] || [];

      // Add new entry
      activities.push(entry);

      // Trim if too long
      const maxActivityEntries = Number.isFinite(this.options.maxActivityEntries) ? this.options.maxActivityEntries : DEFAULT_STORE_OPTIONS.maxActivityEntries;
      if (activities.length > maxActivityEntries) {
        activities.splice(0, activities.length - maxActivityEntries);
      }

      // Save trimmed log
      await this.performSave(this.KEYS.ACTIVITY, activities);

      // Also update the timestamp on the job snapshot
      const snapshot = await this.loadSnapshot();
      if (snapshot && snapshot.jobId === entry.jobId) {
        snapshot.timestamp = entry.timestamp;
        await this.saveSnapshot(snapshot);
      }
    } catch (error) {
      console.error('Failed to append activity:', error);
      // Don't throw - activity logging should not break the main flow
    }
  }

  /**
   * Load activity log entries
   */
  async loadActivity(limit) {
    try {
      const result = await chrome.storage.local.get(this.KEYS.ACTIVITY);
      const activities = result[this.KEYS.ACTIVITY] || [];

      // Validate entries
      const validActivities = activities.filter(entry => this.isValidActivity(entry));

      if (validActivities.length !== activities.length) {
        console.warn(`Filtered ${activities.length - validActivities.length} invalid activity entries`);
        // Clean up invalid entries
        await this.performSave(this.KEYS.ACTIVITY, validActivities);
      }

      // Apply limit if specified
      if (limit && limit > 0) {
        return validActivities.slice(-limit);
      }

      return validActivities;
    } catch (error) {
      console.error('Failed to load activity log:', error);
      return [];
    }
  }

  /**
   * Clear all data for a specific job
   */
  async clear(jobId) {
    try {
      // Clear snapshot if it matches the job ID
      const snapshot = await this.loadSnapshot();
      if (snapshot && snapshot.jobId === jobId) {
        await this.clearSnapshot();
      }

      // Filter activity log to remove entries for this job
      const result = await chrome.storage.local.get(this.KEYS.ACTIVITY);
      const activities = result[this.KEYS.ACTIVITY] || [];
      const filteredActivities = activities.filter(entry => entry.jobId !== jobId);

      if (filteredActivities.length !== activities.length) {
        await this.performSave(this.KEYS.ACTIVITY, filteredActivities);
      }

      // Clear from queue history
      await this.clearFromQueueHistory(jobId);

    } catch (error) {
      console.error('Failed to clear job data:', error);
    }
  }

  /**
   * Save job queue summary
   */
  async saveQueue(queue) {
    if (!this.isValidQueue(queue)) {
      throw new Error('Invalid queue data');
    }

    await this.performSave(this.KEYS.QUEUE, queue);
  }

  /**
   * Load job queue summary
   */
  async loadQueue() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.QUEUE);
      const queueData = result[this.KEYS.QUEUE];

      if (queueData && this.isValidQueue(queueData)) {
        return queueData;
      }
    } catch (error) {
      console.error('Failed to load queue data:', error);
    }

    return null;
  }

  /**
   * Clear the job snapshot
   */
  async clearSnapshot() {
    try {
      await chrome.storage.local.remove(this.KEYS.SNAPSHOT);
      this.lastSave.delete(this.KEYS.SNAPSHOT);
    } catch (error) {
      console.error('Failed to clear snapshot:', error);
    }
  }

  /**
   * Clear the activity log
   */
  async clearActivity() {
    try {
      await chrome.storage.local.remove(this.KEYS.ACTIVITY);
      this.lastSave.delete(this.KEYS.ACTIVITY);
    } catch (error) {
      console.error('Failed to clear activity log:', error);
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats() {
    try {
      const usedBytes = await chrome.storage.local.getBytesInUse();

      // Get individual component sizes
      const result = await chrome.storage.local.get([
        this.KEYS.SNAPSHOT,
        this.KEYS.ACTIVITY,
        this.KEYS.QUEUE,
        this.KEYS.HISTORY
      ]);

      const snapshotSize = this.calculateSize(result[this.KEYS.SNAPSHOT]);
      const activitySize = this.calculateSize(result[this.KEYS.ACTIVITY]);
      const queueSize = this.calculateSize(result[this.KEYS.QUEUE]);
      const historySize = this.calculateSize(result[this.KEYS.HISTORY]);

      return {
        usedBytes,
        availableBytes: null,
        snapshotSize,
        activitySize,
        queueSize,
        historySize
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        usedBytes: 0,
        availableBytes: null,
        snapshotSize: 0,
        activitySize: 0,
        queueSize: 0,
        historySize: 0
      };
    }
  }

  /**
   * Clean up old data to free storage space
   */
  async cleanup(maxAgeDays = 30) {
    try {
      const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      let cleaned = 0;

      // Clean old activity entries
      const result = await chrome.storage.local.get(this.KEYS.ACTIVITY);
      const activities = result[this.KEYS.ACTIVITY] || [];
      const recentActivities = activities.filter(entry => {
        const entryTime = new Date(entry.timestamp).getTime();
        return entryTime > cutoffTime;
      });

      if (recentActivities.length < activities.length) {
        cleaned += activities.length - recentActivities.length;
        await this.performSave(this.KEYS.ACTIVITY, recentActivities);
      }

      // Clean old queue history
      const queueResult = await chrome.storage.local.get(this.KEYS.HISTORY);
      const queueHistory = queueResult[this.KEYS.HISTORY] || [];
      const recentHistory = queueHistory.filter(entry => entry.timestamp > cutoffTime);

      if (recentHistory.length < queueHistory.length) {
        cleaned += queueHistory.length - recentHistory.length;
        await this.performSave(this.KEYS.HISTORY, recentHistory);
      }

      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
      return 0;
    }
  }

  /**
   * Perform the actual save operation with retry logic
   */
  async performSave(key, data, attempt = 1) {
    try {
      // Add timestamp for tracking
      const dataWithTimestamp = Array.isArray(data) ? [...data] : { ...data };
      Object.defineProperty(dataWithTimestamp, '_lastUpdated', {
        value: Date.now(),
        enumerable: false,
        configurable: true,
        writable: true
      });

      await chrome.storage.local.set({ [key]: dataWithTimestamp });
    } catch (error) {
      const maxAttempts = Number.isFinite(this.options.retryAttempts) ? this.options.retryAttempts : DEFAULT_STORE_OPTIONS.retryAttempts;
      const retryDelay = Number.isFinite(this.options.retryDelay) ? this.options.retryDelay : DEFAULT_STORE_OPTIONS.retryDelay;
      if (attempt <= maxAttempts) {
        console.warn(`Save attempt ${attempt} failed for ${key}, retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        return this.performSave(key, data, attempt + 1);
      } else {
        console.error(`Save failed for ${key} after ${attempt - 1} retries:`, error);
        throw error;
      }
    }
  }

  /**
   * Schedule a deferred save operation
   */
  scheduleSave(key, data) {
    // Clear existing timeout
    const existingTimeout = this.saveQueue.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new save
    const timeout = setTimeout(async () => {
      this.saveQueue.delete(key);
      await this.performSave(key, data);
      this.lastSave.set(key, Date.now());
    }, Number.isFinite(this.options.debounceDelay) ? this.options.debounceDelay : DEFAULT_STORE_OPTIONS.debounceDelay);

    this.saveQueue.set(key, timeout);
  }

  /**
   * Calculate approximate size of data in bytes
   */
  calculateSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Remove job from queue history
   */
  async clearFromQueueHistory(jobId) {
    try {
      const result = await chrome.storage.local.get(this.KEYS.HISTORY);
      const history = result[this.KEYS.HISTORY] || [];
      const filteredHistory = history.filter(entry => entry.jobId !== jobId);

      if (filteredHistory.length !== history.length) {
        await this.performSave(this.KEYS.HISTORY, filteredHistory);
      }
    } catch (error) {
      console.error('Failed to clear from queue history:', error);
    }
  }

  /**
   * Validate snapshot structure
   */
  isValidSnapshot(data) {
    return data &&
           typeof data.jobId === 'string' &&
           typeof data.status === 'string' &&
           typeof data.stage === 'string' &&
           typeof data.stageIndex === 'number' &&
           data.stageUnits &&
           typeof data.stageUnits.processed === 'number' &&
           typeof data.weightedPercent === 'number' &&
           typeof data.activity === 'string' &&
           typeof data.timestamp === 'string';
  }

  /**
   * Validate activity entry structure
   */
  isValidActivity(data) {
    return data &&
           typeof data.jobId === 'string' &&
           typeof data.timestamp === 'string' &&
           typeof data.level === 'string' &&
           typeof data.message === 'string' &&
           ['info', 'warn', 'error'].includes(data.level);
  }

  /**
   * Validate queue data structure
   */
  isValidQueue(data) {
    return data &&
           typeof data.total === 'number' &&
           typeof data.pending === 'number' &&
           typeof data.running === 'number' &&
           typeof data.paused === 'number' &&
           Array.isArray(data.recentJobs);
  }

  /**
   * Add job to history for tracking
   */
  async addToHistory(jobSnapshot) {
    try {
      const result = await chrome.storage.local.get(this.KEYS.HISTORY);
      const history = result[this.KEYS.HISTORY] || [];

      // Add new entry with the full job snapshot
      const historyEntry = {
        ...jobSnapshot,
        historyTimestamp: Date.now() // Keep track of when it was added to history
      };
      history.push(historyEntry);

      // Trim to max history size
      const maxHistory = Number.isFinite(this.options.maxQueueHistory) ? this.options.maxQueueHistory : DEFAULT_STORE_OPTIONS.maxQueueHistory;
      if (history.length > maxHistory) {
        history.splice(0, history.length - maxHistory);
      }

      await this.performSave(this.KEYS.HISTORY, history);
    } catch (error) {
      console.error('Failed to add job to history:', error);
    }
  }

  /**
   * Get job history
   */
  async getHistory() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.HISTORY);
      return result[this.KEYS.HISTORY] || [];
    } catch (error) {
      console.error('Failed to get job history:', error);
      return [];
    }
  }

  /**
   * Get a specific job from history by ID
   */
  async getJobFromHistory(jobId) {
    try {
      const history = await this.getHistory();
      return history.find(entry => entry.jobId === jobId) || null;
    } catch (error) {
      console.error('Failed to get job from history:', error);
      return null;
    }
  }

  /**
   * Check storage quota and warn if approaching limits
   */
  async checkQuotaWarning() {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      return { warning: false, usage, quota: null };
    } catch (error) {
      console.error('Failed to check quota:', error);
      return { warning: false, usage: 0, quota: null };
    }
  }

  /**
   * Migrate from old storage format
   */
  async migrateFromLegacy() {
    try {
      // Check if migration already performed
      const migrationResult = await chrome.storage.local.get(this.KEYS.MIGRATION);
      if (migrationResult[this.KEYS.MIGRATION]) {
        return { migrated: false };
      }

      // Check for legacy data
      const legacyKeys = ['dedupeJob', 'cleanupJob', 'jobState'];
      const legacyData = {};

      for (const key of legacyKeys) {
        const result = await chrome.storage.local.get(key);
        if (result[key]) {
          legacyData[key] = result[key];
        }
      }

      if (Object.keys(legacyData).length === 0) {
        // Mark migration as completed
        await chrome.storage.local.set({ [this.KEYS.MIGRATION]: { migrated: true, timestamp: Date.now() } });
        return { migrated: false };
      }

      // Perform migration
      console.log('Migrating legacy job data...', legacyData);

      // Migrate snapshot
      if (legacyData.dedupeJob || legacyData.cleanupJob) {
        const legacySnapshot = legacyData.dedupeJob || legacyData.cleanupJob;
        if (legacySnapshot) {
          await this.performSave(this.KEYS.SNAPSHOT, legacySnapshot);
        }
      }

      // Clean up legacy data
      await chrome.storage.local.remove(legacyKeys);

      // Mark migration as completed
      await chrome.storage.local.set({
        [this.KEYS.MIGRATION]: {
          migrated: true,
          timestamp: Date.now(),
          migratedKeys: legacyKeys
        }
      });

      return { migrated: true };
    } catch (error) {
      console.error('Migration failed:', error);
      return {
        migrated: false,
        error: error instanceof Error ? error.message : 'Unknown migration error'
      };
    }
  }

  /**
   * Reset all stored data
   */
  async reset() {
    try {
      await chrome.storage.local.remove([
        this.KEYS.SNAPSHOT,
        this.KEYS.ACTIVITY,
        this.KEYS.QUEUE,
        this.KEYS.HISTORY,
        this.KEYS.MIGRATION
      ]);

      // Clear in-memory state
      this.lastSave.clear();
      this.saveQueue.forEach(timeout => clearTimeout(timeout));
      this.saveQueue.clear();
    } catch (error) {
      console.error('Failed to reset job store:', error);
    }
  }
}

/**
 * Global job store instance
 */
let globalJobStore = null;

/**
 * Get or create the global job store instance
 */
export function getJobStore(options) {
  if (!globalJobStore) {
    globalJobStore = new JobStore(options);
  }
  return globalJobStore;
}

/**
 * Dispose the global job store
 */
export function disposeJobStore() {
  if (globalJobStore) {
    // Clear any pending saves
    globalJobStore = null;
  }
}
