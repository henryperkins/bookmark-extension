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
   * Start a new cleanup job
   */
  async startJob(requestedBy = 'manual', schedule = null) {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    const result = await jobSystem.handleCommand('START_JOB', {
      queueMeta: {
        requestedBy,
        schedule
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
  }
};

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