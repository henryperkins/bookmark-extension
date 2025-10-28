/**
 * Shared type definitions for the job runner system.
 *
 * The runtime implementations of these helpers live in {@link ./jobTypes.js}.
 * This file exists purely to provide strong typings for TypeScript and IDEs
 * while keeping the background service worker as plain JavaScript.
 */

export type JobStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'cancelled'
  | 'failed'
  | 'completed';

export type StageId =
  | 'initializing'
  | 'scanning'
  | 'grouping'
  | 'resolving'
  | 'verifying'
  | 'summarizing';

export type ActivityLevel = 'info' | 'warn' | 'error';

export type JobCommand =
  | 'START_JOB'
  | 'PAUSE_JOB'
  | 'RESUME_JOB'
  | 'CANCEL_JOB'
  | 'GET_JOB_STATUS'
  | 'GET_ACTIVITY_LOG';

export interface StageUnits {
  processed: number;
  total?: number | null;
}

export interface QueueMeta {
  requestedBy: 'alarm' | 'popup' | 'manual';
  requestedAt: string;
  schedule?: Record<string, unknown> | null;
}

export interface JobSummary {
  totalBookmarks: number;
  duplicatesFound: number;
  duplicatesResolved: number;
  conflictsDetected: number;
  conflictsResolved: number;
  autoApplied: boolean;
  runtimeMs: number;
  startedAt: string | null;
  completedAt: string | null;
  reviewQueueSize: number;
  averageSimilarity?: number;
  taggingAccuracy?: number;
  [extra: string]: unknown;
}

export interface JobSnapshot {
  jobId: string;
  status: JobStatus;
  stage: StageId;
  stageIndex: number;
  stageUnits: StageUnits;
  weightedPercent: number;
  indeterminate: boolean;
  activity: string;
  timestamp: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  summary?: JobSummary;
  error?: string;
  queueMeta?: QueueMeta;
}

export interface JobActivity {
  jobId: string;
  timestamp: string;
  level: ActivityLevel;
  message: string;
  stage?: StageId;
  context?: Record<string, unknown>;
}

export interface QueueHistoryEntry {
  jobId: string;
  timestamp: number;
}

export interface JobQueueSummary {
  total: number;
  pending: number;
  running: number;
  paused: number;
  recentJobs: Array<{
    jobId: string;
    status: JobStatus;
    createdAt: string;
    completedAt?: string | null;
  }>;
}

export type StageWeightMap = Record<StageId, number>;

export interface StageConfig {
  id: StageId;
  displayName: string;
  description: string;
  weight: number;
  canPause: boolean;
  canCancel: boolean;
  estimatedUnits?: number;
  retryable: boolean;
}

export type StageConfigMap = Record<StageId, StageConfig>;

export interface StageContext {
  jobId: string;
  stage: StageId;
  processedUnits: number;
  totalUnits: number;
  abortController: AbortController | null;
  progressCallback: (processed: number, total?: number | null) => void;
  activityCallback: (
    level: ActivityLevel,
    message: string,
    context?: Record<string, unknown>
  ) => void;
}

export interface StageResult {
  completed: boolean;
  processedUnits?: number;
  totalUnits?: number;
  summary?: Partial<JobSummary> | Record<string, unknown> | null;
  error?: unknown;
}

export interface StageExecutor {
  prepare?(): Promise<void> | void;
  execute(context: StageContext): Promise<StageResult>;
  teardown?(): Promise<void> | void;
  canPause?(): boolean;
  canCancel?(): boolean;
}

export interface JobEvent {
  type:
    | 'jobStatus'
    | 'stageProgress'
    | 'jobActivity'
    | 'jobCommand'
    | 'jobQueue'
    | 'jobConnected'
    | 'jobDisconnected';
  job?: JobSnapshot;
  stage?: StageId;
  processed?: number;
  total?: number;
  activity?: JobActivity;
  queue?: JobQueueSummary;
  command?: JobCommand;
  payload?: Record<string, unknown>;
  portName?: string;
  senderId?: string;
}

export interface StorageStats {
  usedBytes: number;
  availableBytes: number;
  snapshotSize: number;
  activitySize: number;
  queueSize: number;
  historySize: number;
}

export interface JobSystemStats {
  initialized: boolean;
  currentJob: JobSnapshot | null;
  connectedPorts: number;
  storageStats: StorageStats;
  uptime: number;
}

export interface JobCommandResult {
  success: boolean;
  error?: string;
  activity?: JobActivity[];
  snapshot?: JobSnapshot | null;
}

export interface JobStore {
  loadSnapshot(): Promise<JobSnapshot | null>;
  saveSnapshot(snapshot: JobSnapshot): Promise<void>;
  appendActivity(entry: JobActivity): Promise<void>;
  loadActivity(limit?: number): Promise<JobActivity[]>;
  clear(jobId: string): Promise<void>;
  saveQueue(queue: JobQueueSummary): Promise<void>;
  loadQueue(): Promise<JobQueueSummary | null>;
  clearSnapshot(): Promise<void>;
  clearActivity(): Promise<void>;
  getStorageStats(): Promise<StorageStats>;
  cleanup(maxAgeDays?: number): Promise<number>;
  addToHistory(jobId: string): Promise<void>;
  getHistory(): Promise<QueueHistoryEntry[]>;
  checkQuotaWarning(): Promise<{ warning: boolean; usage: number; quota: number }>;
  migrateFromLegacy(): Promise<{ migrated: boolean; error?: string }>;
  reset(): Promise<void>;
}

export interface JobBus {
  connect(name: string): chrome.runtime.Port | null;
  disconnect(name: string): void;
  publish(event: JobEvent): void;
  subscribe(name: string, listener: (event: JobEvent) => void): () => void;
  unsubscribe(name: string): void;
  getStats(): { connectedPorts: number; subscriberCount: number; messageQueueSize: number; uptime: number };
}

export {
  STAGE_ORDER,
  JOB_STATUSES,
  JOB_COMMANDS,
  DEFAULT_STAGE_WEIGHTS,
  STAGE_CONFIGS,
  calculateWeightedPercent,
  getStageDisplayName,
  getStageDescription,
  isValidJobStatus,
  isValidStage,
  createEmptyJobSummary,
  isStageUnits
} from './jobTypes.js';