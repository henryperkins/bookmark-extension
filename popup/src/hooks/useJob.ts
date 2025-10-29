import { useJobContext } from '../context/JobContext';

/**
 * Hook to access job state and controls
 *
 * @example
 * const { snapshot, isConnected, dispatch } = useJob();
 *
 * // Start a job
 * dispatch('START_JOB', { queueMeta: { requestedBy: 'popup' } });
 *
 * // Pause the current job
 * dispatch('PAUSE_JOB');
 *
 * // Resume the current job
 * dispatch('RESUME_JOB');
 *
 * // Cancel the current job
 * dispatch('CANCEL_JOB');
 */
export function useJob() {
  const context = useJobContext();

  return {
    // Job state
    snapshot: context.snapshot,
    activity: context.activity,
    isConnected: context.isConnected,
    error: context.error,

    // Actions
    dispatch: context.dispatch,
    refreshStatus: context.refreshStatus,

    // Computed helpers
    isRunning: context.snapshot?.status === 'running',
    isPaused: context.snapshot?.status === 'paused',
    isActive: context.snapshot && ['queued', 'running', 'paused'].includes(context.snapshot.status),
    isComplete: context.snapshot?.status === 'completed',
    isFailed: context.snapshot?.status === 'failed',
    isCancelled: context.snapshot?.status === 'cancelled',

    // Progress helpers
    progress: context.snapshot?.weightedPercent || 0,
    currentStage: context.snapshot?.stage || null,
    currentActivity: context.snapshot?.activity || null,
  };
}
