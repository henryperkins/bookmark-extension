import { useJob } from '../hooks/useJob';
import { useI18n } from '../i18n';
import { useAccessibility } from '../hooks/useAccessibility';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { AccessibilityAnnouncer } from './AccessibilityAnnouncer';
import { useEffect } from 'react';
import designTokens from '../styles/designSystem';



export function ProgressHeader() {
  const { t } = useI18n();
  const { prefersReducedMotion, announceToScreenReader } = useAccessibility();
  const { utils, tokens } = useDesignSystem();
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

  const stageName = currentStage ? t(`jobProgress.stages.${currentStage}`) || currentStage : t('jobProgress.status.unknown');
  const progressPercent = Math.round(progress);
  const isIndeterminate = snapshot.indeterminate;

  // Announce job status changes to screen readers
  useEffect(() => {
    if (isComplete) {
      announceToScreenReader(t('jobProgress.status.completed'), 'assertive');
    } else if (isFailed) {
      announceToScreenReader(t('jobProgress.status.failed'), 'assertive');
    } else if (isRunning && currentStage) {
      announceToScreenReader(`${t('jobProgress.status.running')}: ${stageName}`, 'polite');
    }
  }, [isComplete, isFailed, isRunning, currentStage, stageName, t, announceToScreenReader]);

  // Determine status color and text
  let statusColor: string = tokens.colors.textSecondary;
  let statusText: string = snapshot.status;

  if (isRunning) {
    statusColor = tokens.colors.primary;
    statusText = t('jobProgress.status.running');
  } else if (isPaused) {
    statusColor = tokens.colors.textMuted;
    statusText = t('jobProgress.status.paused');
  } else if (isComplete) {
    statusColor = tokens.colors.success;
    statusText = t('jobProgress.status.completed');
  } else if (isFailed) {
    statusColor = tokens.colors.danger;
    statusText = t('jobProgress.status.failed');
  }

  return (
    <div
      style={{
        padding: tokens.spacing.lg,
        borderBottom: `1px solid ${tokens.colors.borderLight}`,
        backgroundColor: tokens.colors.white,
      }}
    >
      {/* Connection status */}
      {!isConnected && (
        <div
          style={{
            marginBottom: tokens.spacing.sm,
            padding: tokens.spacing.sm,
            backgroundColor: '#fff4ce',
            border: '1px solid #ffb900',
            borderRadius: tokens.borderRadius.medium,
            ...utils.typography.caption(),
            color: tokens.colors.text,
          }}
        >
          {t('jobProgress.connectionLost')}
        </div>
      )}

      {/* Error banner */}
      {(error || snapshot.error) && (
        <div
          role="alert"
          style={{
            marginBottom: tokens.spacing.sm,
            padding: tokens.spacing.sm,
            backgroundColor: '#fde7e9',
            border: `1px solid ${tokens.colors.danger}`,
            borderRadius: tokens.borderRadius.medium,
            ...utils.typography.caption(),
            color: tokens.colors.danger,
          }}
        >
          <strong>{t('jobProgress.errorPrefix')}</strong> {error || snapshot.error}
        </div>
      )}

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.spacing.sm,
        }}
      >
        {/* Status and stage */}
        <div>
          <div
            style={{
              ...utils.typography.body(),
              fontWeight: designTokens.typography.weightSemibold,
              color: statusColor,
              marginBottom: '2px',
            }}
          >
            {statusText}
          </div>
          <div
            style={{
              ...utils.typography.caption(),
              color: tokens.colors.textMuted,
              lineHeight: tokens.typography.lineCaption,
            }}
          >
            {t('jobProgress.stagePrefix')} {stageName}
          </div>
        </div>

        {/* Control buttons */}
        {isActive && (
          <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
            {isRunning && (
              <button
                onClick={() => dispatch('PAUSE_JOB')}
                style={{
                  ...utils.button.secondary({
                    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
                  }),
                  backgroundColor: tokens.colors.textSecondary,
                  color: tokens.colors.white,
                }}
                aria-label={t('jobProgress.pauseJob')}
              >
                {t('jobProgress.pauseJob')}
              </button>
            )}

            {isPaused && (
              <button
                onClick={() => dispatch('RESUME_JOB')}
                style={utils.button.primary({
                  padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
                })}
                aria-label={t('jobProgress.resumeJob')}
              >
                {t('jobProgress.resumeJob')}
              </button>
            )}

            {(isRunning || isPaused) && (
              <button
                onClick={() => {
                  if (confirm(t('jobProgress.cancelConfirm'))) {
                    dispatch('CANCEL_JOB');
                  }
                }}
                style={utils.button.danger({
                  padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
                })}
                aria-label={t('jobProgress.cancelJob')}
              >
                {t('jobProgress.cancelJob')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginBottom: tokens.spacing.xs,
        }}
      >
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isIndeterminate ? undefined : progressPercent}
          aria-valuetext={isIndeterminate ? t('jobProgress.loadingText') : `${progressPercent}% complete`}
          aria-live="polite"
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: tokens.colors.borderLight,
            borderRadius: tokens.borderRadius.medium,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: isIndeterminate ? '100%' : `${progressPercent}%`,
              backgroundColor: isComplete ? tokens.colors.success : isFailed ? tokens.colors.danger : tokens.colors.primary,
              transition: prefersReducedMotion ? 'none' : `width ${tokens.transitions.normal}`,
              animation: isIndeterminate && !prefersReducedMotion ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
        </div>
      </div>

      {/* Activity message */}
      <div
        aria-live="polite"
        style={{
          ...utils.typography.caption(),
          color: tokens.colors.textMuted,
          lineHeight: tokens.typography.lineCaption,
        }}
      >
        {currentActivity || t('jobProgress.waitingText')}
      </div>

      {/* Progress percentage */}
      {!isIndeterminate && (
        <div
          style={{
            marginTop: tokens.spacing.xs,
            ...utils.typography.caption({
              color: tokens.colors.textSecondary,
              fontWeight: tokens.typography.weightSemibold,
            }),
          }}
        >
          {progressPercent}%
        </div>
      )}

      {/* Completion summary */}
      {isComplete && snapshot.summary && (
        <div
          style={{
            marginTop: tokens.spacing.sm,
            padding: tokens.spacing.sm,
            backgroundColor: tokens.colors.background,
            borderRadius: '4px',
            fontSize: tokens.typography.fontCaption,
            color: tokens.colors.text,
          }}
        >
          <strong>{t('jobProgress.summaryTitle')}</strong>
          {snapshot.summary.duplicatesFound !== undefined && (
            <div>{t('jobProgress.duplicatesFound', { count: snapshot.summary.duplicatesFound })}</div>
          )}
          {snapshot.summary.duplicatesResolved !== undefined && (
            <div>{t('jobProgress.duplicatesResolved', { count: snapshot.summary.duplicatesResolved })}</div>
          )}
          {snapshot.summary.totalBookmarks !== undefined && (
            <div>{t('jobProgress.totalBookmarks', { count: snapshot.summary.totalBookmarks })}</div>
          )}
          {snapshot.summary.runtimeMs !== undefined && (
            <div>{t('jobProgress.runtime', { seconds: Math.round(snapshot.summary.runtimeMs / 1000) })}</div>
          )}
        </div>
      )}

      {/* Accessibility announcements for screen readers */}
      <AccessibilityAnnouncer
        message={
          isComplete
            ? t('jobProgress.status.completed')
            : isFailed
            ? t('jobProgress.status.failed')
            : isRunning
            ? `${t('jobProgress.status.running')}: ${stageName}`
            : isPaused
            ? t('jobProgress.status.paused')
            : ''
        }
        priority={isComplete || isFailed ? 'assertive' : 'polite'}
      />

      {/* Add pulse animation for indeterminate state */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
