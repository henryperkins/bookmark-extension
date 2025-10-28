/**
 * Job Runner Core
 * Manages job lifecycle, state transitions, and stage coordination
 */

import {
  JobStatus,
  StageId,
  JobCommand,
  JobSnapshot,
  JobActivity,
  JobContext,
  StageExecutor,
  StageResult,
  StageContext,
  StageUnits,
  ActivityLevel,
  StageWeightMap,
  DEFAULT_STAGE_WEIGHTS,
  calculateWeightedPercent,
  STAGE_CONFIGS
} from '../../shared/jobTypes.js';
import { JobBus } from './jobBus.js';
import { JobStore } from './jobStore.js';

export interface JobRunnerOptions {
  maxRetries?: number;
  retryDelay?: number;
  stageWeights?: StageWeightMap;
  autoPauseOnError?: boolean;
}

export class JobRunner {
  private currentJob: JobSnapshot | null = null;
  private abortController: AbortController | null = null;
  private stageExecutors: Map<StageId, StageExecutor> = new Map();
  private jobBus: JobBus;
  private jobStore: JobStore;
  private options: JobRunnerOptions;
  private retryCount: Map<StageId, number> = new Map();
  private subscribers: Set<() => void> = new Set();

  constructor(jobBus: JobBus, jobStore: JobStore, options: JobRunnerOptions = {}) {
    this.jobBus = jobBus;
    this.jobStore = jobStore;
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      stageWeights: DEFAULT_STAGE_WEIGHTS,
      autoPauseOnError: true,
      ...options
    };

    // Subscribe to job bus events
    this.jobBus.subscribe('job-runner', (event) => {
      if (event.type === 'jobStatus' && event.job?.jobId === this.currentJob?.jobId) {
        this.currentJob = event.job;
        this.notifySubscribers();
      }
    });
  }

  /**
   * Register a stage executor for a specific stage
   */
  registerStageExecutor(stage: StageId, executor: StageExecutor): void {
    this.stageExecutors.set(stage, executor);
  }

  /**
   * Start a new job or resume an existing one
   */
  async startJob(queueMeta?: { requestedBy: 'alarm' | 'popup' | 'manual'; schedule?: any }): Promise<string> {
    const jobId = this.generateJobId();
    const now = new Date().toISOString();

    // Load existing snapshot if available
    const existingSnapshot = await this.jobStore.loadSnapshot();
    if (existingSnapshot && existingSnapshot.status === 'paused') {
      // Resume existing job
      this.currentJob = {
        ...existingSnapshot,
        status: 'queued',
        queueMeta: {
          ...existingSnapshot.queueMeta,
          requestedBy: queueMeta?.requestedBy || 'manual',
          requestedAt: now
        }
      };
    } else {
      // Create new job
      this.currentJob = {
        jobId,
        status: 'queued',
        stage: 'initializing',
        stageIndex: 0,
        stageUnits: { processed: 0, total: 1 },
        weightedPercent: 0,
        indeterminate: true,
        activity: 'Job queued',
        timestamp: now,
        queueMeta: {
          requestedBy: queueMeta?.requestedBy || 'manual',
          requestedAt: now,
          schedule: queueMeta?.schedule
        }
      };
    }

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();
    this.addActivity('info', 'Job started', { jobId });

    // Begin execution immediately
    this.executeNext();

    return jobId;
  }

  /**
   * Handle job commands
   */
  async handleCommand(command: JobCommand, payload?: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    if (!this.currentJob && command !== 'START_JOB') {
      return { success: false, error: 'No active job to control' };
    }

    try {
      switch (command) {
        case 'START_JOB':
          await this.startJob(payload?.queueMeta as any);
          break;

        case 'PAUSE_JOB':
          await this.pauseJob();
          break;

        case 'RESUME_JOB':
          await this.resumeJob();
          break;

        case 'CANCEL_JOB':
          await this.cancelJob();
          break;

        case 'GET_JOB_STATUS':
          return { success: true };

        case 'GET_ACTIVITY_LOG':
          const activity = await this.jobStore.loadActivity(50);
          return { success: true, ...payload, activity };

        default:
          return { success: false, error: `Unknown command: ${command}` };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addActivity('error', `Command failed: ${command}`, { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Pause the current job
   */
  private async pauseJob(): Promise<void> {
    if (!this.currentJob || this.currentJob.status !== 'running') {
      throw new Error('Job is not running');
    }

    this.currentJob.status = 'paused';
    this.currentJob.activity = 'Job paused';
    this.currentJob.timestamp = new Date().toISOString();

    // Abort any running operations
    if (this.abortController) {
      this.abortController.abort();
    }

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();
    this.addActivity('info', 'Job paused by user');
  }

  /**
   * Resume a paused job
   */
  private async resumeJob(): Promise<void> {
    if (!this.currentJob || this.currentJob.status !== 'paused') {
      throw new Error('No paused job to resume');
    }

    this.currentJob.status = 'running';
    this.currentJob.activity = 'Job resumed';
    this.currentJob.timestamp = new Date().toISOString();
    this.abortController = new AbortController();

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();
    this.addActivity('info', 'Job resumed');

    // Continue from where we left off
    this.executeCurrentStage();
  }

  /**
   * Cancel the current job
   */
  private async cancelJob(): Promise<void> {
    if (!this.currentJob || ['cancelled', 'completed'].includes(this.currentJob.status)) {
      throw new Error('No active job to cancel');
    }

    this.currentJob.status = 'cancelling';
    this.currentJob.activity = 'Cancelling job...';
    this.currentJob.timestamp = new Date().toISOString();

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();
    this.addActivity('warn', 'Job cancelled by user');

    // Abort all operations
    if (this.abortController) {
      this.abortController.abort();
    }

    // Cleanup and finalize
    await this.finalizeJob('cancelled');
  }

  /**
   * Execute the next stage or resume current stage
   */
  private async executeNext(): Promise<void> {
    if (!this.currentJob) return;

    if (this.currentJob.status !== 'queued') return;

    this.currentJob.status = 'running';
    this.abortController = new AbortController();

    const stages: StageId[] = ['initializing', 'scanning', 'grouping', 'resolving', 'verifying', 'summarizing'];
    const currentStageIndex = this.currentJob.stageIndex;
    const nextStageIndex = currentStageIndex + 1;

    if (nextStageIndex < stages.length) {
      this.currentJob.stageIndex = nextStageIndex;
      this.currentJob.stage = stages[nextStageIndex];
      this.currentJob.stageUnits = { processed: 0, total: undefined };
      this.currentJob.indeterminate = true;
      this.currentJob.activity = `Starting ${STAGE_CONFIGS[this.currentJob.stage].displayName} stage`;
      this.currentJob.timestamp = new Date().toISOString();

      await this.jobStore.saveSnapshot(this.currentJob);
      this.publishJobStatus();

      // Begin execution
      await this.executeCurrentStage();
    } else {
      // All stages complete
      await this.finalizeJob('completed');
    }
  }

  /**
   * Execute the current stage
   */
  private async executeCurrentStage(): Promise<void> {
    if (!this.currentJob) return;

    const stage = this.currentJob.stage;
    const executor = this.stageExecutors.get(stage);

    if (!executor) {
      this.addActivity('error', `No executor registered for stage: ${stage}`);
      await this.handleStageError(stage, new Error(`No executor found for stage: ${stage}`));
      return;
    }

    try {
      this.addActivity('info', `Starting ${STAGE_CONFIGS[stage].displayName} stage`);

      // Prepare stage
      await executor.prepare();

      // Create stage context
      const stageContext: StageContext = {
        jobId: this.currentJob.jobId,
        stage,
        processedUnits: this.currentJob.stageUnits.processed,
        totalUnits: this.currentJob.stageUnits.total || 0,
        abortController: this.abortController!,
        progressCallback: (processed: number, total?: number) => {
          this.updateStageProgress(processed, total);
        },
        activityCallback: (level: ActivityLevel, message: string, context?: Record<string, unknown>) => {
          this.addActivity(level, message, context);
        }
      };

      // Execute stage
      const result = await executor.execute(stageContext);

      // Complete stage
      await executor.teardown();

      if (result.completed) {
        this.addActivity('info', `Completed ${STAGE_CONFIGS[stage].displayName} stage`);
        await this.completeStage(result);
      } else {
        await this.handleStageError(stage, result.error || new Error('Stage execution incomplete'));
      }

    } catch (error) {
      this.addActivity('error', `Error in ${STAGE_CONFIGS[stage].displayName} stage`, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      await this.handleStageError(stage, error as Error);
    }
  }

  /**
   * Handle stage errors with retry logic
   */
  private async handleStageError(stage: StageId, error: Error): Promise<void> {
    if (!this.currentJob) return;

    const stageConfig = STAGE_CONFIGS[stage];
    const currentRetries = this.retryCount.get(stage) || 0;

    if (stageConfig.retryable && currentRetries < (this.options.maxRetries || 3)) {
      this.retryCount.set(stage, currentRetries + 1);
      
      this.addActivity('warn', `Retrying ${STAGE_CONFIGS[stage].displayName} stage (${currentRetries + 1}/${this.options.maxRetries})`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
      
      // Retry execution
      this.executeCurrentStage();
    } else {
      // Max retries reached or stage not retryable
      this.currentJob.status = this.options.autoPauseOnError ? 'paused' : 'failed';
      this.currentJob.error = error.message;
      this.currentJob.activity = `Stage failed: ${STAGE_CONFIGS[stage].displayName}`;
      this.currentJob.timestamp = new Date().toISOString();

      await this.jobStore.saveSnapshot(this.currentJob);
      this.publishJobStatus();

      this.addActivity('error', `${STAGE_CONFIGS[stage].displayName} stage failed permanently`, { 
        error: error.message,
        retries: currentRetries
      });
    }
  }

  /**
   * Update stage progress
   */
  private updateStageProgress(processed: number, total?: number): void {
    if (!this.currentJob) return;

    const stageUnits: StageUnits = { processed, total };
    const weightedPercent = calculateWeightedPercent(this.currentJob.stage, stageUnits, this.options.stageWeights);

    this.currentJob.stageUnits = stageUnits;
    this.currentJob.weightedPercent = weightedPercent;
    this.currentJob.indeterminate = !total || total === 0;
    this.currentJob.timestamp = new Date().toISOString();

    // Debounced save
    this.debouncedSave();

    // Publish progress update
    this.jobBus.publish({
      type: 'stageProgress',
      stage: this.currentJob.stage,
      processed,
      total,
      job: this.currentJob
    });
  }

  /**
   * Complete current stage and move to next
   */
  private async completeStage(result: StageResult): Promise<void> {
    if (!this.currentJob) return;

    // Update final stage progress
    this.currentJob.stageUnits = {
      processed: result.processedUnits,
      total: result.totalUnits
    };
    this.currentJob.weightedPercent = calculateWeightedPercent(
      this.currentJob.stage, 
      this.currentJob.stageUnits, 
      this.options.stageWeights
    );

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();

    // Move to next stage
    await this.executeNext();
  }

  /**
   * Finalize job with completion summary
   */
  private async finalizeJob(status: 'completed' | 'cancelled' | 'failed'): Promise<void> {
    if (!this.currentJob) return;

    const now = new Date().toISOString();
    const startTime = new Date(this.currentJob.timestamp).getTime();
    const endTime = new Date(now).getTime();
    const runtimeMs = endTime - startTime;

    this.currentJob.status = status;
    this.currentJob.activity = `Job ${status}`;
    this.currentJob.timestamp = now;
    this.currentJob.weightedPercent = status === 'completed' ? 100 : this.currentJob.weightedPercent;

    // Generate summary if completed
    if (status === 'completed') {
      this.currentJob.summary = {
        totalBookmarks: 0, // Will be populated by stages
        duplicatesFound: 0,
        duplicatesResolved: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        autoApplied: false,
        runtimeMs,
        startedAt: this.currentJob.timestamp,
        completedAt: now,
        reviewQueueSize: 0
      };
    }

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();

    // Add final activity
    this.addActivity(
      status === 'completed' ? 'info' : status === 'cancelled' ? 'warn' : 'error',
      `Job ${status} at ${new Date().toLocaleTimeString()}`,
      { runtimeMs }
    );

    // Cleanup
    this.abortController = null;
    this.retryCount.clear();
  }

  /**
   * Add activity log entry
   */
  private addActivity(level: ActivityLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.currentJob) return;

    const activity: JobActivity = {
      jobId: this.currentJob.jobId,
      timestamp: new Date().toISOString(),
      level,
      message,
      stage: this.currentJob.stage,
      context
    };

    // Store activity
    this.jobStore.appendActivity(activity).catch(console.error);

    // Publish activity event
    this.jobBus.publish({
      type: 'jobActivity',
      activity
    });

    // Update job snapshot activity
    this.currentJob.activity = message;
    this.debouncedSave();
  }

  /**
   * Publish job status update
   */
  private publishJobStatus(): void {
    if (!this.currentJob) return;

    this.jobBus.publish({
      type: 'jobStatus',
      job: this.currentJob
    });

    this.notifySubscribers();
  }

  /**
   * Subscribe to job runner updates
   */
  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in job runner subscriber:', error);
      }
    });
  }

  /**
   * Get current job snapshot
   */
  getCurrentJob(): JobSnapshot | null {
    return this.currentJob;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Debounced save to prevent excessive storage writes
   */
  private debouncedSave = this.debounce(async () => {
    if (this.currentJob) {
      await this.jobStore.saveSnapshot(this.currentJob);
    }
  }, 500);

  /**
   * Simple debounce utility
   */
  private debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout | null = null;
    return ((...args: any[]) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    }) as T;
  }

  /**
   * Initialize job runner with stored state
   */
  async initialize(): Promise<void> {
    // Load existing job snapshot
    const snapshot = await this.jobStore.loadSnapshot();
    if (snapshot) {
      this.currentJob = snapshot;
      
      // If job was running when service worker shut down, mark as paused
      if (snapshot.status === 'running') {
        snapshot.status = 'paused';
        snapshot.activity = 'Job paused due to service worker restart';
        await this.jobStore.saveSnapshot(snapshot);
        this.addActivity('warn', 'Job paused due to service worker restart');
      }
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.subscribers.clear();
    this.retryCount.clear();
  }
}