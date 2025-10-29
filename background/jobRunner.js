/**
 * Job Runner Core
 * Manages job lifecycle, state transitions, and stage coordination
 */

import {
  CLEANUP_STAGE_ORDER,
  CLEANUP_STAGE_WEIGHTS,
  STAGE_CONFIGS,
  TEST_CONNECTION_STAGE_ORDER,
  TEST_CONNECTION_STAGE_WEIGHTS,
  calculateWeightedPercent,
  createEmptyJobSummary
} from '../shared/jobTypes.js';

const DEFAULT_OPTIONS = {
  maxRetries: 3,
  retryDelay: 1000,
  stageWeights: CLEANUP_STAGE_WEIGHTS,
  autoPauseOnError: true
};

export class JobRunner {
  constructor(jobBus, jobStore, options = {}) {
    this.currentJob = null;
    this.abortController = null;
    this.stageExecutors = new Map();
    this.jobBus = jobBus;
    this.jobStore = jobStore;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.retryCount = new Map();
    this.subscribers = new Set();

    // Subscribe to job bus events
    this.jobBus.subscribe('job-runner', (event) => {
      if (event.type === 'jobStatus' && event.job?.jobId && this.currentJob && event.job.jobId === this.currentJob.jobId) {
        this.currentJob = event.job;
        this.notifySubscribers();
      }
    });
  }

  /**
   * Register a stage executor for a specific stage
   */
  registerStageExecutor(stage, executor) {
    if (this.stageExecutors.has(stage)) {
      // To support service worker re-initialization, we'll just warn.
      console.warn(`Stage executor for "${stage}" is already registered. Overwriting.`);
    }
    this.stageExecutors.set(stage, executor);
  }

  /**
   * Start a new job or resume an existing one
   */
  async startJob(queueMeta = {}) {
    const { jobType = 'cleanup' } = queueMeta;
    const isConnectionTest = jobType === 'test-connection';

    const stages = isConnectionTest ? TEST_CONNECTION_STAGE_ORDER : CLEANUP_STAGE_ORDER;
    const stageWeights = isConnectionTest ? TEST_CONNECTION_STAGE_WEIGHTS : CLEANUP_STAGE_WEIGHTS;

    const initialStage = stages[0];
    const now = new Date().toISOString();

    // Load existing snapshot if available and compatible
    const existingSnapshot = await this.jobStore.loadSnapshot();
    const canResume = existingSnapshot &&
      existingSnapshot.status === 'paused' &&
      existingSnapshot.queueMeta?.jobType === jobType;

    if (canResume) {
      const resumeStageIndex = typeof existingSnapshot.stageIndex === 'number'
        ? existingSnapshot.stageIndex
        : Math.max(stages.indexOf(existingSnapshot.stage), 0);
      const resumeStage = stages[resumeStageIndex] || initialStage;

      const mergedMeta = {
        ...(existingSnapshot.queueMeta || {}),
        ...(queueMeta || {})
      };
      mergedMeta.requestedBy = queueMeta?.requestedBy || existingSnapshot.queueMeta?.requestedBy || 'manual';
      mergedMeta.requestedAt = now;
      mergedMeta.schedule = queueMeta?.schedule ?? existingSnapshot.queueMeta?.schedule ?? null;

      this.currentJob = {
        ...existingSnapshot,
        status: 'queued',
        stageIndex: resumeStageIndex,
        stage: resumeStage,
        timestamp: now,
        activity: 'Job resumed',
        stageOrder: stages,
        stageWeights,
        queueMeta: {
          ...mergedMeta
        }
      };

      if (!this.currentJob.summary) {
        this.currentJob.summary = createEmptyJobSummary();
      }
      if (!this.currentJob.createdAt) {
        this.currentJob.createdAt = now;
      }
    } else {
      const jobId = this.generateJobId();
      const mergedMeta = {
        ...(queueMeta || {})
      };
      mergedMeta.requestedBy = queueMeta?.requestedBy || 'manual';
      mergedMeta.requestedAt = now;
      mergedMeta.schedule = queueMeta?.schedule ?? null;

      this.currentJob = {
        jobId,
        status: 'queued',
        stage: initialStage,
        stageIndex: 0,
        stageUnits: { processed: 0, total: null },
        weightedPercent: 0,
        indeterminate: true,
        activity: 'Job queued',
        timestamp: now,
        createdAt: now,
        startedAt: null,
        completedAt: null,
        summary: createEmptyJobSummary(),
        stageOrder: stages,
        stageWeights,
        queueMeta: mergedMeta
      };
    }

    this.retryCount.clear();
    this.abortController = null;

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();
    this.addActivity('info', 'Job queued', { jobId: this.currentJob.jobId });

    // Begin execution immediately
    this.executeNext().catch((error) => {
      console.error('Job execution failed:', error);
      this.addActivity('error', 'Job execution failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    });

    return this.currentJob.jobId;
  }

  /**
   * Handle job commands
   */
  async handleCommand(command, payload = {}) {
    if (!this.currentJob && !['START_JOB', 'GET_JOB_STATUS'].includes(command)) {
      const snapshot = await this.jobStore.loadSnapshot();
      return { success: true, snapshot: snapshot || null };
    }

    try {
      switch (command) {
        case 'START_JOB':
          await this.startJob(payload.queueMeta || {});
          break;

        case 'PAUSE_JOB':
          break;

        case 'GET_JOB_STATUS': {
          const snapshot = this.getCurrentJob() || await this.jobStore.loadSnapshot();
          return { success: true, snapshot: snapshot || null };
        }

        case 'GET_ACTIVITY_LOG':
          const activityLimit = typeof payload.limit === 'number' ? payload.limit : 50;
          const activity = await this.jobStore.loadActivity(activityLimit);
          return { success: true, activity };

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
  async pauseJob() {
    if (!this.currentJob || !['running', 'queued'].includes(this.currentJob.status)) {
      return;
    }

    this.updateJob({
      status: 'paused',
      activity: 'Job paused',
      timestamp: new Date().toISOString()
    });

    // Abort any running operations
    if (this.abortController) {
      this.abortController.abort();
    }

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();
    this.addActivity('info', 'Job paused by user');
  }
  
  /**
   * Update job properties and notify subscribers
   */
  updateJob(props) {
    if (!this.currentJob) return;
    
    this.currentJob = { ...this.currentJob, ...props };
    this.debouncedSave();
    this.publishJobStatus();
  }

  /**
   * Resume a paused job
   */
  async resumeJob() {
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
  async cancelJob() {
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
  async executeNext() {
    if (!this.currentJob) return;

    if (!['queued', 'running'].includes(this.currentJob.status)) {
      return;
    }

    const stages = this.currentJob.stageOrder || CLEANUP_STAGE_ORDER;
    const currentStageIndex = this.currentJob.stageIndex || 0;

    if (currentStageIndex >= stages.length) {
      await this.finalizeJob('completed');
      return;
    }

    const stage = stages[currentStageIndex];
    const stageMeta = STAGE_CONFIGS[stage] || { displayName: stage };

    this.currentJob.stage = stage;
    this.currentJob.status = 'running';
    this.currentJob.stageUnits = this.currentJob.stageUnits || { processed: 0, total: null };
    this.currentJob.stageUnits.processed = this.currentJob.stageUnits.processed || 0;
    this.currentJob.indeterminate = true;
    this.currentJob.activity = `Starting ${stageMeta.displayName} stage`;
    this.currentJob.timestamp = new Date().toISOString();

    this.abortController = new AbortController();

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();

    // Begin execution
    await this.executeCurrentStage();
  }

  /**
   * Execute the current stage
   */
  async executeCurrentStage() {
    if (!this.currentJob) return;

    const stage = this.currentJob.stage;
    const executor = this.stageExecutors.get(stage);
    const stageMeta = STAGE_CONFIGS[stage] || { displayName: stage, retryable: true };

    if (!executor) {
      this.addActivity('error', `No executor registered for stage: ${stage}`);
      await this.handleStageError(stage, new Error(`No executor found for stage: ${stage}`));
      return;
    }

    try {
      this.addActivity('info', `Starting ${stageMeta.displayName} stage`);

      if (!this.currentJob.startedAt) {
        this.currentJob.startedAt = new Date().toISOString();
      }

      // Prepare stage
      if (typeof executor.prepare === 'function') {
        await executor.prepare();
      }

      // Create stage context
      const stageContext = {
        jobId: this.currentJob.jobId,
        stage,
        processedUnits: this.currentJob.stageUnits.processed,
        totalUnits: this.currentJob.stageUnits.total || 0,
        abortController: this.abortController,
        progressCallback: (processed, total) => {
          this.updateStageProgress(processed, total);
        },
        activityCallback: (level, message, context) => {
          this.addActivity(level, message, context);
        }
      };

      // Execute stage
      const result = await executor.execute(stageContext);

      // Complete stage
      if (typeof executor.teardown === 'function') {
        await executor.teardown();
      }

      if (result.completed) {
        this.addActivity('info', `Completed ${stageMeta.displayName} stage`);
        await this.completeStage(result);
      } else {
        await this.handleStageError(stage, result.error || new Error('Stage execution incomplete'));
      }

    } catch (error) {
      this.addActivity('error', `Error in ${stageMeta.displayName} stage`, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      await this.handleStageError(stage, error);
    }
  }

  /**
   * Handle stage errors with retry logic
   */
  async handleStageError(stage, error) {
    if (!this.currentJob) return;

    const stageConfig = STAGE_CONFIGS[stage] || { displayName: stage, retryable: false };
    const currentRetries = this.retryCount.get(stage) || 0;

    const maxRetries = Number.isFinite(this.options.maxRetries) ? this.options.maxRetries : DEFAULT_OPTIONS.maxRetries;

    if (stageConfig.retryable && currentRetries < maxRetries) {
      this.retryCount.set(stage, currentRetries + 1);

      this.addActivity('warn', `Retrying ${stageConfig.displayName} stage (${currentRetries + 1}/${maxRetries})`);

      const retryDelay = Number.isFinite(this.options.retryDelay) ? this.options.retryDelay : DEFAULT_OPTIONS.retryDelay;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));

      this.executeCurrentStage().catch((err) => {
        console.error('Retry execution failed:', err);
      });
    } else {
      // Max retries reached or stage not retryable
      const message = error instanceof Error ? error.message : String(error || 'Unknown error');
      this.currentJob.status = this.options.autoPauseOnError ? 'paused' : 'failed';
      this.currentJob.error = message;
      this.currentJob.activity = `Stage failed: ${stageConfig.displayName}`;
      this.currentJob.timestamp = new Date().toISOString();

      await this.jobStore.saveSnapshot(this.currentJob);
      this.publishJobStatus();

      this.addActivity('error', `${stageConfig.displayName} stage failed permanently`, { 
        error: message,
        retries: currentRetries
      });

      this.retryCount.delete(stage);
    }
  }

  /**
   * Update stage progress
   */
  updateStageProgress(processed, total) {
    if (!this.currentJob) return;

    const stageUnits = {
      processed: typeof processed === 'number' ? processed : 0,
      total: typeof total === 'number' ? total : null
    };
    const stageWeights = this.currentJob.stageWeights || this.options.stageWeights;
    const weightedPercent = calculateWeightedPercent(this.currentJob.stage, stageUnits, stageWeights);

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
  async completeStage(result) {
    if (!this.currentJob) return;

    // Update final stage progress
    this.currentJob.stageUnits = {
      processed: typeof result.processedUnits === 'number' ? result.processedUnits : this.currentJob.stageUnits.processed,
      total: typeof result.totalUnits === 'number' ? result.totalUnits : this.currentJob.stageUnits.total
    };
    const stageWeights = this.currentJob.stageWeights || this.options.stageWeights;
    this.currentJob.weightedPercent = calculateWeightedPercent(
      this.currentJob.stage,
      this.currentJob.stageUnits,
      stageWeights
    );

    if (result.summary && typeof result.summary === 'object') {
      this.currentJob.summary = {
        ...(this.currentJob.summary || createEmptyJobSummary()),
        ...result.summary
      };
    }

    this.retryCount.delete(this.currentJob.stage);

    await this.jobStore.saveSnapshot(this.currentJob);
    this.publishJobStatus();

    // Move to next stage
    this.currentJob.stageIndex = (this.currentJob.stageIndex || 0) + 1;
    await this.executeNext();
  }

  /**
   * Finalize job with completion summary
   */
  async finalizeJob(status) {
    if (!this.currentJob) return;

    const now = new Date().toISOString();
    const startedAtValue = this.currentJob.startedAt || this.currentJob.createdAt || now;
    const startTime = new Date(startedAtValue).getTime();
    const endTime = new Date(now).getTime();
    const runtimeMs = Math.max(0, endTime - startTime);

    this.currentJob.status = status;
    this.currentJob.activity = `Job ${status}`;
    this.currentJob.timestamp = now;
    this.currentJob.completedAt = status === 'completed' ? now : this.currentJob.completedAt || null;
    this.currentJob.weightedPercent = status === 'completed' ? 100 : this.currentJob.weightedPercent;
    this.currentJob.indeterminate = false;

    // Generate summary if completed
    if (status === 'completed') {
      const summary = {
        ...(this.currentJob.summary || createEmptyJobSummary()),
        runtimeMs,
        startedAt: startedAtValue,
        completedAt: now
      };
      this.currentJob.summary = summary;
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
  addActivity(level, message, context) {
    if (!this.currentJob) return;

    const activity = {
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
  publishJobStatus() {
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
  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /**
   * Notify all subscribers
   */
  notifySubscribers() {
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
  getCurrentJob() {
    return this.currentJob;
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Debounced save to prevent excessive storage writes
   */
  debouncedSave = this.debounce(async () => {
    if (this.currentJob) {
      await this.jobStore.saveSnapshot(this.currentJob);
    }
  }, 500);

  /**
   * Simple debounce utility
   */
  debounce(func, wait) {
    let timeout = null;
    return (...args) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Initialize job runner with stored state
   */
  async initialize() {
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
  dispose() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.subscribers.clear();
    this.retryCount.clear();
  }
}
