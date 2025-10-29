/**
 * Shared job system constants, helper utilities, and lightweight type hints.
 * The popup UI and background scripts both import from this module so it must
 * stay framework agnostic and execute as plain JavaScript without build
 * tooling.  Type information is expressed with JSDoc so editors can still
 * provide good IntelliSense.
 */

/**
 * @typedef {(
 *   'idle' |
 *   'queued' |
 *   'running' |
 *   'paused' |
 *   'cancelling' |
 *   'cancelled' |
 *   'failed' |
 *   'completed'
 * )} JobStatus
 */

/**
 * @typedef {(
 *   'initializing' |
 *   'scanning' |
 *   'grouping' |
 *   'resolving' |
 *   'verifying' |
 *   'summarizing' |
 *   'testingConnection'
 * )} StageId
 */

/**
 * @typedef {'info' | 'warn' | 'error'} ActivityLevel
 */

/**
 * @typedef {'START_JOB' | 'PAUSE_JOB' | 'RESUME_JOB' | 'CANCEL_JOB' | 'GET_JOB_STATUS' | 'GET_ACTIVITY_LOG'} JobCommand
 */

/**
 * @typedef {{ processed: number, total?: number | null }} StageUnits
 */

/**
 * @typedef {{
 *   totalBookmarks: number;
 *   duplicatesFound: number;
 *   duplicatesResolved: number;
 *   conflictsDetected: number;
 *   conflictsResolved: number;
 *   autoApplied: boolean;
 *   runtimeMs: number;
 *   startedAt: string | null;
 *   completedAt: string | null;
 *   reviewQueueSize: number;
 *   averageSimilarity?: number;
 *   taggingAccuracy?: number;
 * }} JobSummary
 */

/**
 * @typedef {{
 *   jobId: string;
 *   status: JobStatus;
 *   stage: StageId;
 *   stageIndex: number;
 *   stageUnits: StageUnits;
 *   weightedPercent: number;
 *   indeterminate: boolean;
 *   activity: string;
 *   timestamp: string;
 *   createdAt: string;
 *   startedAt?: string | null;
 *   completedAt?: string | null;
 *   summary?: JobSummary;
 *   error?: string;
 *   queueMeta?: {
 *     requestedBy: 'alarm' | 'popup' | 'manual';
 *     requestedAt: string;
 *     schedule?: Record<string, unknown> | null;
 *   };
 *   stageOrder?: StageId[];
 *   stageWeights?: Record<string, number>;
 * }} JobSnapshot
 */

/**
 * @typedef {{
 *   jobId: string;
 *   timestamp: string;
 *   level: ActivityLevel;
 *   message: string;
 *   stage?: StageId;
 *   context?: Record<string, unknown>;
 * }} JobActivity
 */

/**
 * Ordered list of stages used by the job runner.  Consumers should rely on this
 * constant when calculating progress or iterating stages to avoid drifting from
 * the background implementation.
 * @type {readonly StageId[]}
 */
export const CLEANUP_STAGE_ORDER = Object.freeze([
  'initializing',
  'scanning',
  'grouping',
  'resolving',
  'verifying',
  'summarizing'
]);

/**
 * Ordered list of stages for the connection test job.
 * @type {readonly StageId[]}
 */
export const TEST_CONNECTION_STAGE_ORDER = Object.freeze([
  'initializing',
  'testingConnection',
  'summarizing'
]);

/**
 * @deprecated Use `CLEANUP_STAGE_ORDER` instead.
 * @type {readonly StageId[]}
 */
export const STAGE_ORDER = CLEANUP_STAGE_ORDER;

/**
 * @type {readonly JobStatus[]}
 */
export const JOB_STATUSES = Object.freeze([
  'idle',
  'queued',
  'running',
  'paused',
  'cancelling',
  'cancelled',
  'failed',
  'completed'
]);

/**
 * @type {readonly JobCommand[]}
 */
export const JOB_COMMANDS = Object.freeze([
  'START_JOB',
  'PAUSE_JOB',
  'RESUME_JOB',
  'CANCEL_JOB',
  'GET_JOB_STATUS',
  'GET_ACTIVITY_LOG'
]);

/**
 * Weightings applied to each stage when computing the overall weighted progress
 * percentage.  Values should add up to 100.
 */
export const CLEANUP_STAGE_WEIGHTS = Object.freeze({
  initializing: 5,
  scanning: 30,
  grouping: 10,
  resolving: 40,
  verifying: 10,
  summarizing: 5
});

/**
 * Weightings for the connection test job.
 */
export const TEST_CONNECTION_STAGE_WEIGHTS = Object.freeze({
  initializing: 20,
  testingConnection: 60,
  summarizing: 20
});

/**
 * @deprecated Use `CLEANUP_STAGE_WEIGHTS` instead.
 */
export const DEFAULT_STAGE_WEIGHTS = CLEANUP_STAGE_WEIGHTS;

/**
 * Metadata for each stage describing display properties and behavior flags.
 */
export const STAGE_CONFIGS = Object.freeze({
  initializing: {
    id: 'initializing',
    displayName: 'Initializing',
    description: 'Preparing the job environment and loading stored state',
    weight: CLEANUP_STAGE_WEIGHTS.initializing,
    canPause: true,
    canCancel: true,
    estimatedUnits: 1,
    retryable: true
  },
  scanning: {
    id: 'scanning',
    displayName: 'Scanning',
    description: 'Reading bookmark metadata and building working sets',
    weight: CLEANUP_STAGE_WEIGHTS.scanning,
    canPause: true,
    canCancel: true,
    estimatedUnits: 100,
    retryable: true
  },
  grouping: {
    id: 'grouping',
    displayName: 'Grouping',
    description: 'Clustering potential duplicates by similarity',
    weight: CLEANUP_STAGE_WEIGHTS.grouping,
    canPause: true,
    canCancel: true,
    estimatedUnits: 10,
    retryable: true
  },
  resolving: {
    id: 'resolving',
    displayName: 'Resolving',
    description: 'Applying dedupe and conflict resolution strategies',
    weight: CLEANUP_STAGE_WEIGHTS.resolving,
    canPause: true,
    canCancel: true,
    estimatedUnits: 50,
    retryable: true
  },
  verifying: {
    id: 'verifying',
    displayName: 'Verifying',
    description: 'Double-checking bookmark integrity and sync alignment',
    weight: CLEANUP_STAGE_WEIGHTS.verifying,
    canPause: true,
    canCancel: true,
    estimatedUnits: 25,
    retryable: true
  },
  summarizing: {
    id: 'summarizing',
    displayName: 'Summarizing',
    description: 'Generating completion summary and persisting results',
    weight: CLEANUP_STAGE_WEIGHTS.summarizing,
    canPause: false,
    canCancel: true,
    estimatedUnits: 1,
    retryable: false
  },
  testingConnection: {
    id: 'testingConnection',
    displayName: 'Testing Connection',
    description: 'Pinging the Azure OpenAI endpoint to verify credentials',
    weight: TEST_CONNECTION_STAGE_WEIGHTS.testingConnection,
    canPause: false,
    canCancel: true,
    estimatedUnits: 1,
    retryable: false
  }
});

const DEFAULT_WEIGHT_TOTAL = STAGE_ORDER.reduce((total, stage) => {
  return total + (DEFAULT_STAGE_WEIGHTS[stage] ?? 0);
}, 0);

/**
 * Clamp a value between two bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate the weighted completion percentage for the current stage progress.
 *
 * @param {StageId} stage
 * @param {StageUnits} stageUnits
 * @param {Record<StageId, number>} [weights]
 * @returns {number}
 */
export function calculateWeightedPercent(stage, stageUnits, weights = DEFAULT_STAGE_WEIGHTS) {
  const order = STAGE_ORDER;
  const totalWeight = order.reduce((sum, name) => sum + (weights[name] ?? 0), 0) || DEFAULT_WEIGHT_TOTAL || 100;
  const currentIndex = order.indexOf(stage);

  if (currentIndex === -1) {
    return 0;
  }

  let completedWeight = 0;
  for (let i = 0; i < currentIndex; i += 1) {
    completedWeight += weights[order[i]] ?? 0;
  }

  const stageWeight = weights[stage] ?? 0;
  let stageProgress = 0;
  if (stageUnits && typeof stageUnits.processed === 'number' && typeof stageUnits.total === 'number' && stageUnits.total > 0) {
    const fraction = clamp(stageUnits.processed / stageUnits.total, 0, 1);
    stageProgress = fraction * stageWeight;
  }

  const weighted = completedWeight + stageProgress;
  return Math.round(clamp((weighted / totalWeight) * 100, 0, 100));
}

/**
 * Convenience helper to return a human readable stage name.
 * @param {StageId} stage
 * @returns {string}
 */
export function getStageDisplayName(stage) {
  return STAGE_CONFIGS[stage]?.displayName ?? stage;
}

/**
 * Convenience helper to return a stage description.
 * @param {StageId} stage
 * @returns {string}
 */
export function getStageDescription(stage) {
  return STAGE_CONFIGS[stage]?.description ?? '';
}

/**
 * Quick validation helpers used throughout the codebase.
 * @param {string} status
 * @returns {status is JobStatus}
 */
export function isValidJobStatus(status) {
  return JOB_STATUSES.includes(/** @type {JobStatus} */ (status));
}

/**
 * @param {string} stage
 * @returns {stage is StageId}
 */
export function isValidStage(stage) {
  return STAGE_ORDER.includes(/** @type {StageId} */ (stage));
}

/**
 * Create a blank summary object so callers can extend safely.
 * @returns {JobSummary}
 */
export function createEmptyJobSummary() {
  return {
    totalBookmarks: 0,
    duplicatesFound: 0,
    duplicatesResolved: 0,
    conflictsDetected: 0,
    conflictsResolved: 0,
    autoApplied: false,
    runtimeMs: 0,
    startedAt: null,
    completedAt: null,
    reviewQueueSize: 0
  };
}

/**
 * Lightweight guard that narrows StageUnits objects.
 * @param {unknown} value
 * @returns {value is StageUnits}
 */
export function isStageUnits(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const { processed, total } = /** @type {{ processed?: unknown, total?: unknown }} */ (value);
  return typeof processed === 'number' && (typeof total === 'number' || total === undefined || total === null);
}