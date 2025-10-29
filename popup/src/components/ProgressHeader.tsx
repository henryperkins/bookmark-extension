import { useJob } from '../hooks/useJob';

// Design system (matching App.tsx)
const styles = {
  typography: {
    fontBody: '14px',
    fontCaption: '12px',
    lineBody: '20px',
    lineCaption: '16px',
    weightRegular: 400,
    weightSemibold: 600,
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
  colors: {
    text: '#1a1a1a',
    textSecondary: '#555',
    textMuted: '#666',
    primary: '#0078d4',
    primaryHover: '#005a9e',
    success: '#107c10',
    danger: '#d13438',
    dangerHover: '#a52a2d',
    border: '#c7c7c7',
    borderLight: '#e0e0e0',
    background: '#f9f9f9',
    white: '#ffffff',
  },
} as const;

// Stage display names (fallback if not in STAGE_CONFIGS)
const STAGE_NAMES: Record<string, string> = {
  initializing: 'Initializing',
  scanning: 'Scanning',
  grouping: 'Grouping',
  resolving: 'Resolving',
  verifying: 'Verifying',
  summarizing: 'Summarizing',
  'parse-html': 'Parsing HTML',
  'create-bookmarks': 'Creating Bookmarks',
  'enrich-bookmarks': 'Enriching Bookmarks',
  'testingConnection': 'Testing Connection',
};

export function ProgressHeader() {
  const {
    snapshot,
    isRunning,
    isPaused,
    isActive,
    isComplete,
    isFailed,
    progress,
    currentStage,
    currentActivity,
    dispatch,
    isConnected,
    error,
  } = useJob();

  // Don't render if no active job
  if (!snapshot) {
    return null;
  }

  const stageName = currentStage ? STAGE_NAMES[currentStage] || currentStage : 'Unknown';
  const progressPercent = Math.round(progress);
  const isIndeterminate = snapshot.indeterminate;

  // Determine status color and text
  let statusColor: string = styles.colors.textSecondary;
  let statusText: string = snapshot.status;

  if (isRunning) {
    statusColor = styles.colors.primary;
    statusText = 'Running';
  } else if (isPaused) {
    statusColor = styles.colors.textMuted;
    statusText = 'Paused';
  } else if (isComplete) {
    statusColor = styles.colors.success;
    statusText = 'Completed';
  } else if (isFailed) {
    statusColor = styles.colors.danger;
    statusText = 'Failed';
  }

  return (
    <div
      style={{
        padding: styles.spacing.lg,
        borderBottom: `1px solid ${styles.colors.borderLight}`,
        backgroundColor: styles.colors.white,
      }}
    >
      {/* Connection status */}
      {!isConnected && (
        <div
          style={{
            marginBottom: styles.spacing.sm,
            padding: styles.spacing.sm,
            backgroundColor: '#fff4ce',
            border: '1px solid #ffb900',
            borderRadius: '4px',
            fontSize: styles.typography.fontCaption,
            color: styles.colors.text,
          }}
        >
          ⚠️ Connection lost. Trying to reconnect...
        </div>
      )}

      {/* Error banner */}
      {(error || snapshot.error) && (
        <div
          role="alert"
          style={{
            marginBottom: styles.spacing.sm,
            padding: styles.spacing.sm,
            backgroundColor: '#fde7e9',
            border: `1px solid ${styles.colors.danger}`,
            borderRadius: '4px',
            fontSize: styles.typography.fontCaption,
            color: styles.colors.danger,
          }}
        >
          <strong>Error:</strong> {error || snapshot.error}
        </div>
      )}

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: styles.spacing.sm,
        }}
      >
        {/* Status and stage */}
        <div>
          <div
            style={{
              fontSize: styles.typography.fontBody,
              fontWeight: styles.typography.weightSemibold,
              color: statusColor,
              marginBottom: '2px',
            }}
          >
            {statusText}
          </div>
          <div
            style={{
              fontSize: styles.typography.fontCaption,
              color: styles.colors.textMuted,
              lineHeight: styles.typography.lineCaption,
            }}
          >
            Stage: {stageName}
          </div>
        </div>

        {/* Control buttons */}
        {isActive && (
          <div style={{ display: 'flex', gap: styles.spacing.sm }}>
            {isRunning && (
              <button
                onClick={() => dispatch('PAUSE_JOB')}
                style={{
                  padding: `${styles.spacing.xs} ${styles.spacing.md}`,
                  fontSize: styles.typography.fontCaption,
                  fontWeight: styles.typography.weightSemibold,
                  color: styles.colors.white,
                  backgroundColor: styles.colors.textSecondary,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                aria-label="Pause job"
              >
                Pause
              </button>
            )}

            {isPaused && (
              <button
                onClick={() => dispatch('RESUME_JOB')}
                style={{
                  padding: `${styles.spacing.xs} ${styles.spacing.md}`,
                  fontSize: styles.typography.fontCaption,
                  fontWeight: styles.typography.weightSemibold,
                  color: styles.colors.white,
                  backgroundColor: styles.colors.primary,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = styles.colors.primaryHover;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = styles.colors.primary;
                }}
                aria-label="Resume job"
              >
                Resume
              </button>
            )}

            {(isRunning || isPaused) && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this job?')) {
                    dispatch('CANCEL_JOB');
                  }
                }}
                style={{
                  padding: `${styles.spacing.xs} ${styles.spacing.md}`,
                  fontSize: styles.typography.fontCaption,
                  fontWeight: styles.typography.weightSemibold,
                  color: styles.colors.white,
                  backgroundColor: styles.colors.danger,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = styles.colors.dangerHover;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = styles.colors.danger;
                }}
                aria-label="Cancel job"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginBottom: styles.spacing.xs,
        }}
      >
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isIndeterminate ? undefined : progressPercent}
          aria-valuetext={isIndeterminate ? 'Loading...' : `${progressPercent}% complete`}
          aria-live="polite"
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: styles.colors.borderLight,
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: isIndeterminate ? '100%' : `${progressPercent}%`,
              backgroundColor: isComplete ? styles.colors.success : isFailed ? styles.colors.danger : styles.colors.primary,
              transition: 'width 0.3s ease-in-out',
              animation: isIndeterminate ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
        </div>
      </div>

      {/* Activity message */}
      <div
        aria-live="polite"
        style={{
          fontSize: styles.typography.fontCaption,
          color: styles.colors.textMuted,
          lineHeight: styles.typography.lineCaption,
        }}
      >
        {currentActivity || 'Waiting...'}
      </div>

      {/* Progress percentage */}
      {!isIndeterminate && (
        <div
          style={{
            marginTop: styles.spacing.xs,
            fontSize: styles.typography.fontCaption,
            color: styles.colors.textSecondary,
            fontWeight: styles.typography.weightSemibold,
          }}
        >
          {progressPercent}%
        </div>
      )}

      {/* Completion summary */}
      {isComplete && snapshot.summary && (
        <div
          style={{
            marginTop: styles.spacing.sm,
            padding: styles.spacing.sm,
            backgroundColor: styles.colors.background,
            borderRadius: '4px',
            fontSize: styles.typography.fontCaption,
            color: styles.colors.text,
          }}
        >
          <strong>Summary:</strong>
          {snapshot.summary.duplicatesFound !== undefined && (
            <div>• Duplicates found: {snapshot.summary.duplicatesFound}</div>
          )}
          {snapshot.summary.duplicatesResolved !== undefined && (
            <div>• Duplicates resolved: {snapshot.summary.duplicatesResolved}</div>
          )}
          {snapshot.summary.totalBookmarks !== undefined && (
            <div>• Total bookmarks: {snapshot.summary.totalBookmarks}</div>
          )}
          {snapshot.summary.runtimeMs !== undefined && (
            <div>• Runtime: {Math.round(snapshot.summary.runtimeMs / 1000)}s</div>
          )}
        </div>
      )}

      {/* Add pulse animation for indeterminate state */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
