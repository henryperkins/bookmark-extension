import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';
import { useAccessibility } from '../hooks/useAccessibility';

// Design system (matching App.tsx)
const styles = {
  typography: {
    fontCaption: '12px',
    fontBody: '14px',
    fontBodyLarge: '18px',
    fontSubtitle: '20px',
    lineCaption: '16px',
    lineBody: '20px',
    lineBodyLarge: '24px',
    lineSubtitle: '28px',
    weightRegular: 400,
    weightSemibold: 600,
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
  },
  colors: {
    text: '#1a1a1a',
    textSecondary: '#555',
    textMuted: '#666',
    primary: '#0078d4',
    primaryHover: '#005a9e',
    success: '#107c10',
    danger: '#d13438',
    border: '#c7c7c7',
    borderLight: '#e0e0e0',
    background: '#f9f9f9',
    backgroundAlt: '#f5f5f5',
    white: '#ffffff',
  },
} as const;

interface JobHistoryEntry {
  jobId: string;
  status: string;
  stage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  summary?: {
    duplicatesFound?: number;
    duplicatesResolved?: number;
    totalBookmarks?: number;
    runtimeMs?: number;
  };
  queueMeta?: {
    requestedBy?: string;
    schedule?: string;
  };
  historyTimestamp: number;
  error?: string;
}

export function JobHistory() {
  const { t } = useI18n();
  const { announceToScreenReader } = useAccessibility();
  const [history, setHistory] = useState<JobHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobHistoryEntry | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await chrome.runtime.sendMessage({
        type: 'jobCommand',
        command: 'GET_JOB_HISTORY'
      });

      if (response.success) {
        setHistory(response.history || []);
      } else {
        console.error('Failed to load job history:', response.error);
      }
    } catch (error) {
      console.error('Error loading job history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const formatDate = (timestamp: string | number) => {
    const date = new Date(
      typeof timestamp === 'string' ? timestamp : new Date(timestamp)
    );
    return date.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return styles.colors.success;
      case 'failed': return styles.colors.danger;
      case 'running': return styles.colors.primary;
      case 'paused': return styles.colors.textSecondary;
      default: return styles.colors.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return t('jobProgress.status.completed');
      case 'failed': return t('jobProgress.status.failed');
      case 'running': return t('jobProgress.status.running');
      case 'paused': return t('jobProgress.status.paused');
      default: return status;
    }
  };

  const toggleJobExpanded = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
      announceToScreenReader(t('accessibility.collapsedDetails'), 'polite');
    } else {
      newExpanded.add(jobId);
      announceToScreenReader(t('accessibility.expandedDetails'), 'polite');
    }
    setExpandedJobs(newExpanded);
  };

  const exportReport = async (jobId: string, format: 'json' | 'csv' | 'txt') => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'jobCommand',
        command: 'EXPORT_REPORT',
        payload: { jobId, format }
      });

      if (response.success && response.downloadUrl) {
        // Create download link
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = response.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up blob URL
        URL.revokeObjectURL(response.downloadUrl);

        announceToScreenReader(t('jobHistory.exportSuccess'), 'polite');
      } else {
        announceToScreenReader(t('jobHistory.exportError'), 'assertive');
      }
    } catch (error) {
      console.error('Export failed:', error);
      announceToScreenReader(t('jobHistory.exportError'), 'assertive');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: styles.spacing.lg }}>
        <p style={{ lineHeight: styles.typography.lineBody }}>
          {t('jobHistory.loading')}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: styles.spacing.lg }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: styles.spacing.lg
      }}>
        <h3 style={{
          fontSize: styles.typography.fontSubtitle,
          lineHeight: styles.typography.lineSubtitle,
          fontWeight: styles.typography.weightSemibold,
          color: styles.colors.text,
          margin: 0,
        }}>
          {t('jobProgress.jobHistory')} ({history.length})
        </h3>

        <button
          onClick={loadHistory}
          style={{
            padding: `${styles.spacing.sm} ${styles.spacing.md}`,
            fontSize: styles.typography.fontCaption,
            fontWeight: styles.typography.weightSemibold,
            color: styles.colors.primary,
            backgroundColor: 'transparent',
            border: `1px solid ${styles.colors.border}`,
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {t('jobHistory.refresh')}
        </button>
      </div>

      {history.length === 0 ? (
        <p style={{
          color: styles.colors.textMuted,
          lineHeight: styles.typography.lineBody,
          textAlign: 'center',
          padding: styles.spacing.xxl,
        }}>
          {t('jobHistory.noHistory')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: styles.spacing.sm }}>
          {history.map((job) => (
            <div
              key={job.jobId}
              style={{
                border: `1px solid ${styles.colors.borderLight}`,
                borderRadius: '4px',
                backgroundColor: styles.colors.white,
                overflow: 'hidden',
              }}
            >
              {/* Job summary */}
              <div
                style={{
                  padding: styles.spacing.md,
                  cursor: 'pointer',
                  backgroundColor: selectedJob?.jobId === job.jobId
                    ? styles.colors.background
                    : 'transparent',
                }}
                onClick={() => toggleJobExpanded(job.jobId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleJobExpanded(job.jobId);
                  }
                }}
                aria-expanded={expandedJobs.has(job.jobId)}
                aria-controls={`job-details-${job.jobId}`}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: styles.spacing.xs,
                }}>
                  <div style={{
                    fontSize: styles.typography.fontBody,
                    fontWeight: styles.typography.weightSemibold,
                    color: styles.colors.text,
                  }}>
                    {job.jobId.substring(0, 8)}...
                    <span style={{
                      marginLeft: styles.spacing.sm,
                      fontSize: styles.typography.fontCaption,
                      color: getStatusColor(job.status),
                      fontWeight: styles.typography.weightRegular,
                    }}>
                      {getStatusText(job.status)}
                    </span>
                  </div>

                  <div style={{
                    fontSize: styles.typography.fontCaption,
                    color: styles.colors.textMuted,
                  }}>
                    {formatDate(job.historyTimestamp)}
                  </div>
                </div>

                {job.stage && (
                  <div style={{
                    fontSize: styles.typography.fontCaption,
                    color: styles.colors.textSecondary,
                    marginBottom: styles.spacing.xs,
                  }}>
                    {t('jobProgress.stagePrefix')} {job.stage}
                  </div>
                )}

                {job.summary && (
                  <div style={{
                    fontSize: styles.typography.fontCaption,
                    color: styles.colors.textMuted,
                  }}>
                    {job.summary.duplicatesFound !== undefined && (
                      <span>
                        {t('jobHistory.duplicatesFound', { count: job.summary.duplicatesFound })}
                      </span>
                    )}
                    {job.summary.runtimeMs && (
                      <span style={{ marginLeft: styles.spacing.sm }}>
                        {t('jobHistory.runtime', { seconds: Math.round(job.summary.runtimeMs / 1000) })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded details */}
              {expandedJobs.has(job.jobId) && (
                <div
                  id={`job-details-${job.jobId}`}
                  style={{
                    borderTop: `1px solid ${styles.colors.borderLight}`,
                    padding: styles.spacing.md,
                    backgroundColor: styles.colors.backgroundAlt,
                  }}
                >
                  <div style={{ marginBottom: styles.spacing.md }}>
                    <h4 style={{
                      fontSize: styles.typography.fontBody,
                      fontWeight: styles.typography.weightSemibold,
                      color: styles.colors.text,
                      marginTop: 0,
                      marginBottom: styles.spacing.sm,
                    }}>
                      {t('jobHistory.details')}
                    </h4>

                    <div style={{
                      fontSize: styles.typography.fontCaption,
                      lineHeight: styles.typography.lineCaption,
                      color: styles.colors.textSecondary,
                    }}>
                      <div><strong>{t('jobHistory.jobId')}:</strong> {job.jobId}</div>
                      <div><strong>{t('jobHistory.created')}:</strong> {formatDate(job.createdAt)}</div>
                      {job.startedAt && (
                        <div><strong>{t('jobHistory.started')}:</strong> {formatDate(job.startedAt)}</div>
                      )}
                      {job.completedAt && (
                        <div><strong>{t('jobHistory.completed')}:</strong> {formatDate(job.completedAt)}</div>
                      )}
                      {job.queueMeta?.requestedBy && (
                        <div><strong>{t('jobHistory.requestedBy')}:</strong> {job.queueMeta.requestedBy}</div>
                      )}
                      {job.error && (
                        <div style={{ color: styles.colors.danger }}>
                          <strong>{t('jobHistory.error')}:</strong> {job.error}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Export options */}
                  <div>
                    <h4 style={{
                      fontSize: styles.typography.fontBody,
                      fontWeight: styles.typography.weightSemibold,
                      color: styles.colors.text,
                      marginTop: 0,
                      marginBottom: styles.spacing.sm,
                    }}>
                      {t('jobHistory.exportReport')}
                    </h4>

                    <div style={{ display: 'flex', gap: styles.spacing.sm }}>
                      {(['json', 'csv', 'txt'] as const).map((format) => (
                        <button
                          key={format}
                          onClick={() => exportReport(job.jobId, format)}
                          style={{
                            padding: `${styles.spacing.xs} ${styles.spacing.sm}`,
                            fontSize: styles.typography.fontCaption,
                            fontWeight: styles.typography.weightSemibold,
                            color: styles.colors.primary,
                            backgroundColor: 'transparent',
                            border: `1px solid ${styles.colors.border}`,
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}