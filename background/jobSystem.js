/**
 * Job System Integration
 * Brings together job runner, event bus, and persistence layer
 * Serves as the main entry point for the new job system
 */

import { JobRunner } from './jobRunner.js';
import { getJobBus } from './jobBus.js';
import { getJobStore } from './jobStore.js';

const DEFAULT_ALLOWED_SENDER_PREFIX = () => `chrome-extension://${chrome.runtime.id}`;

export class JobSystemImpl {
  constructor(options = {}) {
    this.store = getJobStore(options.jobStore);
    this.bus = getJobBus(options.jobBus);
    this.runner = new JobRunner(this.bus, this.store, options.jobRunner);

    this.initialized = false;
    this.startTime = Date.now();
    this.messageListener = null;
    this.runnerUnsubscribe = null;

    this.setupEventFlow();
  }

  /**
   * Initialize the job system
   */
  async initialize() {
    if (this.initialized) {
      console.warn('Job system already initialized');
      return;
    }

    try {
      console.log('Initializing job system...');

      // Perform migration from legacy storage if needed
      const migrationResult = await this.store.migrateFromLegacy();
      if (migrationResult.migrated) {
        console.log('Successfully migrated legacy data');
      }

      // Initialize the job runner with stored state
      await this.runner.initialize();
      this.setupEventFlow();

      // Set up message listener for commands from popup
      this.setupMessageListener();

      // Load and publish current state
      const snapshot = await this.store.loadSnapshot();
      if (snapshot) {
        this.bus.publish({
          type: 'jobStatus',
          job: snapshot
        });
      }

      this.startTime = Date.now();
      this.initialized = true;
      console.log('Job system initialized successfully');

    } catch (error) {
      console.error('Failed to initialize job system:', error);
      throw error;
    }
  }

  /**
   * Get current job snapshot
   */
  getCurrentJob() {
    return this.runner.getCurrentJob();
  }

  /**
   * Handle job commands from popup or other sources
   */
  async handleCommand(command, payload = {}) {
    if (!this.initialized) {
      return { success: false, error: 'Job system not initialized' };
    }

    try {
      return await this.runner.handleCommand(command, payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Command ${command} failed:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Register a stage executor for a specific stage
   */
  registerStageExecutor(stage, executor) {
    this.runner.registerStageExecutor(stage, executor);
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (!this.initialized) return;

    console.log('Disposing job system...');
    
    this.runner.dispose();
    this.bus.dispose();
    if (this.runnerUnsubscribe) {
      this.runnerUnsubscribe();
      this.runnerUnsubscribe = null;
    }
    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
      this.messageListener = null;
    }
    
    this.initialized = false;
    console.log('Job system disposed');
  }

  /**
   * Set up event flow between components
   */
  setupEventFlow() {
    if (this.runnerUnsubscribe) {
      this.runnerUnsubscribe();
      this.runnerUnsubscribe = null;
    }

    this.runnerUnsubscribe = this.runner.subscribe(() => {
      const currentJob = this.runner.getCurrentJob();
      if (currentJob) {
        this.bus.publish({
          type: 'jobStatus',
          job: currentJob
        });
      }
    });
  }

  /**
   * Set up message listener for chrome.runtime messages
   */
  setupMessageListener() {
    if (this.messageListener) {
      return;
    }

    this.messageListener = (message, sender, sendResponse) => {
      try {
        if (!message || message.type !== 'jobCommand' || !message.command) {
          return;
        }

        const senderId = sender && sender.id ? sender.id : null;
        const senderOrigin = sender && (sender.origin || sender.url) ? (sender.origin || sender.url) : '';
        const isAuthorized = senderId === chrome.runtime.id || (typeof senderOrigin === 'string' && senderOrigin.startsWith(DEFAULT_ALLOWED_SENDER_PREFIX()));

        if (!isAuthorized) {
          console.warn('Unauthorized message sender:', senderOrigin || senderId);
          sendResponse({ success: false, error: 'Unauthorized' });
          return true;
        }

        this.handleCommand(message.command, message.payload)
          .then(result => {
            sendResponse(result);
          })
          .catch(error => {
            console.error('Command handling error:', error);
            sendResponse({ success: false, error: 'Internal error' });
          });

        return true;
      } catch (error) {
        console.error('Unexpected message handling error:', error);
        sendResponse({ success: false, error: 'Internal error' });
        return true;
      }
    };

    chrome.runtime.onMessage.addListener(this.messageListener);
  }

  /**
   * Get system statistics
   */
  async getStats() {
    const storageStats = await this.store.getStorageStats();
    const busStats = this.bus.getStats();

    return {
      initialized: this.initialized,
      currentJob: this.getCurrentJob(),
      connectedPorts: busStats.connectedPorts,
      storageStats,
      uptime: Date.now() - this.startTime
    };
  }
}

/**
 * Global job system instance
 */
let globalJobSystem = null;

/**
 * Initialize the job system
 */
export async function initializeJobSystem(options = {}) {
  if (globalJobSystem) {
    console.warn('Job system already initialized');
    return globalJobSystem;
  }

  globalJobSystem = new JobSystemImpl(options);
  await globalJobSystem.initialize();
  
  return globalJobSystem;
}

/**
 * Get the global job system instance
 */
export function getJobSystem() {
  return globalJobSystem;
}

/**
 * Dispose the global job system
 */
export function disposeJobSystem() {
  if (globalJobSystem) {
    globalJobSystem.dispose();
    globalJobSystem = null;
  }
}

/**
 * Convenience functions for common operations
 */
export const JobSystemCommands = {
  /**
   * Start a new job
   */
  async startJob(requestedBy = 'manual', options = {}) {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    const schedule = options?.schedule ?? null;
    const metadata = options?.metadata && typeof options.metadata === 'object'
      ? options.metadata
      : {};

    const result = await jobSystem.handleCommand('START_JOB', {
      queueMeta: {
        requestedBy,
        schedule,
        ...metadata
      }
    });
    if (result.success) {
      const currentJob = jobSystem.getCurrentJob();
      return { success: true, jobId: currentJob ? currentJob.jobId : undefined };
    }
    return { success: false, error: result.error };
  },

  /**
   * Pause the current job
   */
  async pauseJob() {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    return jobSystem.handleCommand('PAUSE_JOB');
  },

  /**
   * Resume a paused job
   */
  async resumeJob() {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    return jobSystem.handleCommand('RESUME_JOB');
  },

  /**
   * Cancel the current job
   */
  async cancelJob() {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    return jobSystem.handleCommand('CANCEL_JOB');
  },

  /**
   * Get current job status
   */
  async getJobStatus() {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    const snapshot = jobSystem.getCurrentJob();
    if (snapshot) {
      return { success: true, snapshot };
    }
    return { success: true, snapshot: null };
  },

  /**
   * Get activity log
   */
  async getActivityLog(limit) {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    const result = await jobSystem.handleCommand('GET_ACTIVITY_LOG', { limit });
    if (result.success) {
      return { success: true, activity: result.activity };
    }
    return { success: false, error: result.error };
  },

  /**
   * Get job history
   */
  async getJobHistory() {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    const jobStore = jobSystem.store;
    const history = await jobStore.getHistory();
    return { success: true, history };
  },

  /**
   * Export a job report in specified format
   */
  async exportReport(options) {
    const { format = 'json', jobId, includeActivity = true, redactUrls = false } = options || {};

    try {
      // Get job data
      const jobSystem = getJobSystem();
      if (!jobSystem) {
        return { success: false, error: 'Job system not initialized' };
      }

      // Get job snapshot
      let snapshot = null;
      if (jobId) {
        // Try to get current job
        const currentJob = jobSystem.getCurrentJob();
        if (currentJob && currentJob.jobId === jobId) {
          // currentJob is already a snapshot object, not a class with getSnapshot()
          snapshot = { ...currentJob };
        } else {
          // Try to get from job store history
          const jobStore = getJobStore();
          const jobInHistory = await jobStore.getJobFromHistory(jobId);

          if (!jobInHistory) {
            return {
              success: false,
              error: 'Job not found. Could not find active or completed job with that ID.'
            };
          }

          snapshot = jobInHistory;
        }
      }

      if (!snapshot) {
        return { success: false, error: 'Job not found' };
      }

      // Get activity log if requested
      let activity = [];
      if (includeActivity) {
        const activityResult = await jobSystem.handleCommand('GET_ACTIVITY_LOG', { limit: 100 });
        if (activityResult.success) {
          activity = activityResult.activity.filter((a) => a.jobId === jobId);
        }
      }

      // Generate report based on format
      const report = generateReport(snapshot, activity, format, redactUrls);
      const filename = `job-report-${jobId}.${format}`;

      // Create blob URL for download
      const blob = new Blob([report], { type: getContentType(format) });
      const downloadUrl = URL.createObjectURL(blob);

      return {
        success: true,
        downloadUrl,
        filename
      };
    } catch (error) {
      console.error('Export report failed:', error);
      return { success: false, error: error.message || 'Export failed' };
    }
  }
};

/**
 * Helper functions for report generation
 */
function generateReport(snapshot, activity, format, redactUrls) {
  switch (format) {
    case 'json':
      // For JSON, handle redaction separately
      let reportData = {
        job: snapshot,
        activity,
        exportedAt: new Date().toISOString()
      };
      if (redactUrls) {
        reportData = redactUrlsFromData(reportData);
      }
      return JSON.stringify(reportData, null, 2);

    case 'csv':
      return generateCsvReport(snapshot, activity, redactUrls);

    case 'txt':
      return generateTextReport(snapshot, activity, redactUrls);

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function generateCsvReport(snapshot, activity, redactUrls) {
  const headers = ['Timestamp', 'Level', 'Message', 'Stage'];
  let rows = activity.map(a => [
    a.timestamp,
    a.level,
    `"${a.message.replace(/"/g, '""')}"`,
    a.stage || ''
  ]);
  
  // Redact URLs from messages if requested
  if (redactUrls) {
    rows = rows.map(row => [
      row[0], // timestamp
      row[1], // level
      redactUrlsFromText(row[2]), // message
      row[3]  // stage
    ]);
  }

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function generateTextReport(snapshot, activity, redactUrls) {
  const jobId = redactUrls ? redactUrlsFromText(snapshot.jobId) : snapshot.jobId;
  const status = redactUrls ? redactUrlsFromText(snapshot.status) : snapshot.status;
  const stage = redactUrls ? redactUrlsFromText(snapshot.stage) : snapshot.stage;
  const createdAt = snapshot.createdAt;
  const startedAt = snapshot.startedAt || 'N/A';
  const completedAt = snapshot.completedAt || 'N/A';
  
  const summary = redactUrls ? redactUrlsFromData(snapshot.summary) : snapshot.summary;
  
  const lines = [
    `Job Report: ${jobId}`,
    `Status: ${status}`,
    `Stage: ${stage}`,
    `Created: ${createdAt}`,
    `Started: ${startedAt}`,
    `Completed: ${completedAt}`,
    '',
    'Summary:',
    JSON.stringify(summary, null, 2),
    '',
    'Activity Log:',
    ...activity.map(a =>
      `[${a.timestamp}] ${a.level.toUpperCase()}: ${redactUrls ? redactUrlsFromText(a.message) : a.message}`
    )
  ];

  return lines.join('\n');
}

// Helper function to redact URLs from text
function redactUrlsFromText(text) {
  if (!text) return text;
  // Regular expression to match URLs
  const urlRegex = /https?:\/\/[^\s"'<>\]]+/gi;
  return text.toString().replace(urlRegex, '[REDACTED-URL]');
}

// Helper function to redact URLs from an entire data structure recursively
function redactUrlsFromData(data) {
  if (typeof data === 'string') {
    return redactUrlsFromText(data);
  } else if (Array.isArray(data)) {
    return data.map(item => redactUrlsFromData(item));
  } else if (data !== null && typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = redactUrlsFromData(value);
    }
    return result;
  } else {
    return data;
  }
}

function getContentType(format) {
  switch (format) {
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'txt': return 'text/plain';
    default: return 'text/plain';
  }
}

/**
 * Example stage executors for the existing bookmark cleanup flow
 */
export class BookmarkProcessingStageExecutor {
  constructor(stageName, processFunction) {
    this.stageName = stageName;
    this.processFunction = processFunction;
  }

  async prepare() {
    console.log(`Preparing ${this.stageName} stage`);
  }

  async execute(context) {
    console.log(`Executing ${this.stageName} stage`);
    return this.processFunction(context);
  }

  async teardown() {
    console.log(`Cleaning up ${this.stageName} stage`);
  }

  canPause() {
    return true;
  }

  canCancel() {
    return true;
  }
}

/**
 * Default export for easy importing
 */
export default JobSystemImpl;
