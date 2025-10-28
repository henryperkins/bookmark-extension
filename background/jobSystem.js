/**
 * Job System Integration
 * Brings together job runner, event bus, and persistence layer
 * Serves as the main entry point for the new job system
 */

import { JobRunner } from './jobRunner.js';
import { JobBus, getJobBus } from './jobBus.js';
import { JobStore, getJobStore } from './jobStore.js';
import {
  JobCommand,
  JobStatus,
  StageId,
  StageExecutor,
  StageContext,
  StageResult,
  ActivityLevel,
  JobSnapshot,
  JobActivity
} from '../../shared/jobTypes.js';

export interface JobSystemOptions {
  jobRunner?: {
    maxRetries?: number;
    retryDelay?: number;
    autoPauseOnError?: boolean;
  };
  jobBus?: {
    heartbeatInterval?: number;
    maxMessageQueue?: number;
    retryAttempts?: number;
  };
  jobStore?: {
    maxActivityEntries?: number;
    maxQueueHistory?: number;
    debounceDelay?: number;
    enableCompression?: boolean;
  };
}

export interface JobSystem {
  runner: JobRunner;
  bus: JobBus;
  store: JobStore;
  initialize(): Promise<void>;
  dispose(): void;
  getCurrentJob(): JobSnapshot | null;
  handleCommand(command: JobCommand, payload?: Record<string, unknown>): Promise<{ success: boolean; error?: string }>;
}

export class JobSystemImpl implements JobSystem {
  public runner: JobRunner;
  public bus: JobBus;
  public store: JobStore;
  private initialized: boolean = false;

  constructor(options: JobSystemOptions = {}) {
    // Initialize components with options
    this.store = getJobStore(options.jobStore);
    this.bus = getJobBus(options.jobBus);
    this.runner = new JobRunner(this.bus, this.store, options.jobRunner);

    // Set up communication between components
    this.setupEventFlow();
  }

  /**
   * Initialize the job system
   */
  async initialize(): Promise<void> {
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
  getCurrentJob(): JobSnapshot | null {
    return this.runner.getCurrentJob();
  }

  /**
   * Handle job commands from popup or other sources
   */
  async handleCommand(command: JobCommand, payload?: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
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
  registerStageExecutor(stage: StageId, executor: StageExecutor): void {
    this.runner.registerStageExecutor(stage, executor);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (!this.initialized) return;

    console.log('Disposing job system...');
    
    this.runner.dispose();
    this.bus.dispose();
    
    this.initialized = false;
    console.log('Job system disposed');
  }

  /**
   * Set up event flow between components
   */
  private setupEventFlow(): void {
    // Subscribe to job runner updates and forward to event bus
    this.runner.subscribe(() => {
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
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Only handle job-related messages
      if (message.type !== 'jobCommand' || !message.command) {
        return;
      }

      // Verify sender is authorized (popup or options page)
      const allowedOrigins = ['chrome-extension://' + chrome.runtime.id];
      if (!allowedOrigins.includes(sender.origin)) {
        console.warn('Unauthorized message sender:', sender.origin);
        sendResponse({ success: false, error: 'Unauthorized' });
        return true;
      }

      // Handle the command
      this.handleCommand(message.command, message.payload)
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          console.error('Command handling error:', error);
          sendResponse({ success: false, error: 'Internal error' });
        });

      // Return true to indicate async response
      return true;
    });
  }

  /**
   * Get system statistics
   */
  async getStats(): Promise<{
    initialized: boolean;
    currentJob: JobSnapshot | null;
    connectedPorts: number;
    storageStats: any;
    uptime: number;
  }> {
    const storageStats = await this.store.getStorageStats();
    const busStats = this.bus.getStats();

    return {
      initialized: this.initialized,
      currentJob: this.getCurrentJob(),
      connectedPorts: busStats.connectedPorts,
      storageStats,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  private startTime: number = Date.now();
}

/**
 * Global job system instance
 */
let globalJobSystem: JobSystemImpl | null = null;

/**
 * Initialize the job system
 */
export async function initializeJobSystem(options?: JobSystemOptions): Promise<JobSystem> {
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
export function getJobSystem(): JobSystem | null {
  return globalJobSystem;
}

/**
 * Dispose the global job system
 */
export function disposeJobSystem(): void {
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
  async startJob(requestedBy: 'alarm' | 'popup' | 'manual' = 'manual', schedule?: any): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    const result = await jobSystem.handleCommand('START_JOB', { queueMeta: { requestedBy, schedule } });
    if (result.success) {
      const currentJob = jobSystem.getCurrentJob();
      return { success: true, jobId: currentJob?.jobId };
    }
    return { success: false, error: result.error };
  },

  /**
   * Pause the current job
   */
  async pauseJob(): Promise<{ success: boolean; error?: string }> {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    return jobSystem.handleCommand('PAUSE_JOB');
  },

  /**
   * Resume a paused job
   */
  async resumeJob(): Promise<{ success: boolean; error?: string }> {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    return jobSystem.handleCommand('RESUME_JOB');
  },

  /**
   * Cancel the current job
   */
  async cancelJob(): Promise<{ success: boolean; error?: string }> {
    const jobSystem = getJobSystem();
    if (!jobSystem) {
      return { success: false, error: 'Job system not initialized' };
    }

    return jobSystem.handleCommand('CANCEL_JOB');
  },

  /**
   * Get current job status
   */
  async getJobStatus(): Promise<{ success: boolean; snapshot?: JobSnapshot; error?: string }> {
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
  async getActivityLog(limit?: number): Promise<{ success: boolean; activity?: JobActivity[]; error?: string }> {
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
export class BookmarkProcessingStageExecutor implements StageExecutor {
  private processFunction: (context: StageContext) => Promise<StageResult>;
  private stageName: string;

  constructor(stageName: string, processFunction: (context: StageContext) => Promise<StageResult>) {
    this.stageName = stageName;
    this.processFunction = processFunction;
  }

  async prepare(): Promise<void> {
    console.log(`Preparing ${this.stageName} stage`);
  }

  async execute(context: StageContext): Promise<StageResult> {
    console.log(`Executing ${this.stageName} stage`);
    return await this.processFunction(context);
  }

  async teardown(): Promise<void> {
    console.log(`Cleaning up ${this.stageName} stage`);
  }

  canPause(): boolean {
    return true;
  }

  canCancel(): boolean {
    return true;
  }
}

/**
 * Default export for easy importing
 */
export default JobSystemImpl;