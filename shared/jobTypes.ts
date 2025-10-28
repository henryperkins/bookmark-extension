/**
 * Shared type definitions for the job runner system
 * Used by both background scripts and popup UI components
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
  | 'GET_ACTIVITY_LOG'
  | 'EXPORT_REPORT'
  | 'CONNECT_PORT'
  | 'DISCONNECT_PORT';

export interface StageUnits {
  processed: number;
  total?: number;
}

export interface QueueMeta {
  requestedBy: 'alarm' | 'popup' | 'manual';
  requestedAt: string;
  schedule?: {
    recurring: boolean;
    interval?: string;
    timezone?: string;
  };
}

export interface JobSummary {
  totalBookmarks: number;
  duplicatesFound: number;
  duplicatesResolved: number;
  conflictsDetected: number;
  conflictsResolved: number;
  autoApplied: boolean;
  runtimeMs: number;
  startedAt: string;
  completedAt: string;
  reviewQueueSize: number;
  averageSimilarity?: number;
  taggingAccuracy?: number;
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
  action?: string;
  context?: Record<string, unknown>;
  targetUrl?: string;
  duplicateOf?: string;
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
    completedAt?: string;
  }>;
}

export interface StageWeightMap {
  initializing: number;
  scanning: number;
  grouping: number;
  resolving: number;
  verifying: number;
  summarizing: number;
}

export interface JobStore {
  loadSnapshot(): Promise<JobSnapshot | null>;
  saveSnapshot(snapshot: JobSnapshot): Promise<void>;
  appendActivity(entry: JobActivity): Promise<void>;
  loadActivity(limit?: number): Promise<JobActivity[]>;
  clear(jobId: string): Promise<void>;
  saveQueue(queue: JobQueueSummary): Promise<void>;
  loadQueue(): Promise<JobQueueSummary | null>;
}

export interface JobBus {
  connect(name: string): chrome.runtime.Port | null;
  disconnect(name: string): void;
  publish(event: JobEvent): void;
  subscribe(name: string, listener: (event: JobEvent) => void): void;
  unsubscribe(name: string): void;
}

export interface StageExecutor {
  prepare(): Promise<void>;
  execute(context: StageContext): Promise<StageResult>;
  teardown(): Promise<void>;
  canPause(): boolean;
  canCancel(): boolean;
}

export interface StageContext {
  jobId: string;
  stage: StageId;
  processedUnits: number;
  totalUnits: number;
  abortController: AbortController;
  progressCallback: (processed: number, total?: number) => void;
  activityCallback: (level: ActivityLevel, message: string, context?: Record<string, unknown>) => void;
}

export interface StageResult {
  completed: boolean;
  processedUnits: number;
  totalUnits: number;
  summary?: Record<string, unknown>;
  error?: Error;
}

export interface JobEvent {
  type: 
    | 'stageStarted'
    | 'stageProgress' 
    | 'stageCompleted'
    | 'jobStatus'
    | 'jobActivity'
    | 'jobQueue'
    | 'jobConnected'
    | 'jobDisconnected';
  job?: JobSnapshot;
  stage?: StageId;
  processed?: number;
  total?: number;
  activity?: JobActivity;
  queue?: JobQueueSummary;
  portName?: string;
}

export interface JobContext {
  snapshot: JobSnapshot | null;
  activity: JobActivity[];
  queue: JobQueueSummary | null;
  dispatch(command: JobCommand, payload?: Record<string, unknown>): void;
  subscribe(listener: () => void): () => void;
  isConnected: boolean;
  lastError?: string;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeActivity: boolean;
  redactUrls: boolean;
  includeMetrics: boolean;
  timeRange?: {
    start: string;
    end: string;
  };
}

export interface ExportResult {
  success: boolean;
  filename: string;
  blob?: Blob;
  error?: string;
  downloadUrl?: string;
}

export interface ErrorInfo {
  code: 'NETWORK' | 'AUTH' | 'QUOTA' | 'STORAGE' | 'RATE_LIMIT' | 'UNEXPECTED';
  message: string;
  recoverable: boolean;
  retryAfter?: number;
  context?: Record<string, unknown>;
  userMessage?: string;
}

export interface AccessibilitySettings {
  announceProgress: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderOptimized: boolean;
}

export interface LocalizationSettings {
  language: string;
  region: string;
  dateFormat: string;
  numberFormat: string;
  timeFormat: '12h' | '24h';
}

export interface NotificationSettings {
  showProgress: boolean;
  showCompletion: boolean;
  showErrors: boolean;
  soundEnabled: boolean;
  urgencyLevels: {
    info: boolean;
    warn: boolean;
    error: boolean;
  };
}

// Default stage weights for progress calculation
export const DEFAULT_STAGE_WEIGHTS: StageWeightMap = {
  initializing: 5,
  scanning: 30,
  grouping: 10,
  resolving: 40,
  verifying: 10,
  summarizing: 5
};

// Stage configurations
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

export const STAGE_CONFIGS: Record<StageId, StageConfig> = {
  initializing: {
    id: 'initializing',
    displayName: 'Initializing',
    description: 'Setting up job environment and loading bookmarks',
    weight: DEFAULT_STAGE_WEIGHTS.initializing,
    canPause: true,
    canCancel: true,
    estimatedUnits: 1,
    retryable: true
  },
  scanning: {
    id: 'scanning',
    displayName: 'Scanning',
    description: 'Loading and analyzing bookmark metadata',
    weight: DEFAULT_STAGE_WEIGHTS.scanning,
    canPause: true,
    canCancel: true,
    estimatedUnits: 100, // per 100 bookmarks
    retryable: true
  },
  grouping: {
    id: 'grouping',
    displayName: 'Grouping',
    description: 'Organizing bookmarks by similarity',
    weight: DEFAULT_STAGE_WEIGHTS.grouping,
    canPause: true,
    canCancel: true,
    estimatedUnits: 10, // per group
    retryable: true
  },
  resolving: {
    id: 'resolving',
    displayName: 'Resolving',
    description: 'Processing duplicates and conflicts',
    weight: DEFAULT_STAGE_WEIGHTS.resolving,
    canPause: true,
    canCancel: true,
    estimatedUnits: 50, // per duplicate
    retryable: true
  },
  verifying: {
    id: 'verifying',
    displayName: 'Verifying',
    description: 'Validating sync conflicts and changes',
    weight: DEFAULT_STAGE_WEIGHTS.verifying,
    canPause: true,
    canCancel: true,
    estimatedUnits: 25, // per bookmark
    retryable: true
  },
  summarizing: {
    id: 'summarizing',
    displayName: 'Summarizing',
    description: 'Generating reports and finalizing changes',
    weight: DEFAULT_STAGE_WEIGHTS.summarizing,
    canPause: false,
    canCancel: true,
    estimatedUnits: 1,
    retryable: false
  }
};

// Utility functions
export const calculateWeightedPercent = (
  currentStage: StageId,
  stageUnits: StageUnits,
  weights: StageWeightMap = DEFAULT_STAGE_WEIGHTS
): number => {
  let totalPercent = 0;
  let processedPercent = 0;

  const stages = Object.keys(weights) as StageId[];
  const currentIndex = stages.indexOf(currentStage);

  // Add completed stages
  for (let i = 0; i < currentIndex; i++) {
    totalPercent += weights[stages[i]];
    processedPercent += weights[stages[i]];
  }

  // Add current stage progress
  if (stageUnits.total && stageUnits.total > 0) {
    const stagePercent = (stageUnits.processed / stageUnits.total) * weights[currentStage];
    processedPercent += stagePercent;
  }

  return Math.round((processedPercent / 100) * 100);
};

export const getStageDisplayName = (stage: StageId): string => {
  return STAGE_CONFIGS[stage].displayName;
};

export const getStageDescription = (stage: StageId): string => {
  return STAGE_CONFIGS[stage].description;
};

export const isValidJobStatus = (status: string): status is JobStatus => {
  const validStatuses: JobStatus[] = [
    'idle', 'queued', 'running', 'paused', 
    'cancelling', 'cancelled', 'failed', 'completed'
  ];
  return validStatuses.includes(status as JobStatus);
};

export const isValidStage = (stage: string): stage is StageId => {
  const validStages: StageId[] = [
    'initializing', 'scanning', 'grouping', 
    'resolving', 'verifying', 'summarizing'
  ];
  return validStages.includes(stage as StageId);
};