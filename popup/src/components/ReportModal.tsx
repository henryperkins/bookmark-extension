import { useState, useEffect, useRef } from 'react';
import { useJob } from '../hooks/useJob';
import { sendRuntimeMessage } from '../utils/chrome';

// Design system (matching other components)
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
    warning: '#ff8c00',
    border: '#c7c7c7',
    borderLight: '#e0e0e0',
    background: '#f9f9f9',
    white: '#ffffff',
  },
} as const;

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'csv' | 'json' | 'audit';
type ExportStatus = 'idle' | 'generating' | 'ready' | 'error';

export function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const { snapshot, activity } = useJob();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [exportData, setExportData] = useState<{ url: string; filename: string } | null>(null);
  const [includeActivity, setIncludeActivity] = useState<boolean>(true);
  const [redactUrls, setRedactUrls] = useState<boolean>(false);
  const [includeTimestamps, setIncludeTimestamps] = useState<boolean>(true);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  // Focus trap effect
  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Find all focusable elements
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      firstFocusableRef.current = focusableElements[0] || null;
      lastFocusableRef.current = focusableElements[focusableElements.length - 1] || null;
      
      // Focus the first element if modal is open
      if (firstFocusableRef.current) {
        firstFocusableRef.current.focus();
      }
    }
  }, [isOpen]);

  // Handle keyboard navigation for focus trapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (lastFocusableRef.current && e.target === lastFocusableRef.current && !e.shiftKey) {
        e.preventDefault();
        if (firstFocusableRef.current) firstFocusableRef.current.focus();
      } else if (firstFocusableRef.current && e.target === firstFocusableRef.current && e.shiftKey) {
        e.preventDefault();
        if (lastFocusableRef.current) lastFocusableRef.current.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || !snapshot) {
    return null;
  }

  const isComplete = snapshot.status === 'completed';
  const summary = snapshot.summary;

  const handleExport = async () => {
    setExportStatus('generating');
    setErrorMessage('');

    try {
      // Send export command to background script
      const response = await sendRuntimeMessage<{
        success: boolean;
        downloadUrl?: string;
        filename?: string;
        error?: string;
      }>({
        type: 'jobCommand',
        command: 'EXPORT_REPORT',
        payload: {
          format: selectedFormat,
          jobId: snapshot.jobId,
          includeActivity: includeActivity,
          redactUrls: redactUrls,
        },
      });

      if (response?.success && response.downloadUrl && response.filename) {
        setExportStatus('ready');
        setExportData({
          url: response.downloadUrl,
          filename: response.filename,
        });
      } else {
        throw new Error(response?.error || 'Export failed');
      }
    } catch (error) {
      setExportStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const handleDownload = () => {
    if (exportData?.url) {
      const link = document.createElement('a');
      link.href = exportData.url;
      link.download = exportData.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const resetExport = () => {
    setExportStatus('idle');
    setErrorMessage('');
    setExportData(null);
  };

  const getFormatDescription = (format: ExportFormat): string => {
    switch (format) {
      case 'csv':
        return 'Comma-separated values with duplicates and actions taken';
      case 'json':
        return 'Structured data with full job metadata and activity log';
      case 'audit':
        return 'Comprehensive archive with logs, snapshots, and metrics';
      default:
        return '';
    }
  };

  const getEstimatedSize = (): string => {
    const baseSize = activity.length * 200; // Rough estimate per activity entry
    switch (selectedFormat) {
      case 'csv':
        return `~${Math.round(baseSize / 1024)} KB`;
      case 'json':
        return `~${Math.round(baseSize * 1.5 / 1024)} KB`;
      case 'audit':
        return `~${Math.round(baseSize * 2 / 1024)} KB`;
      default:
        return '~0 KB';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: styles.spacing.lg,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: styles.colors.white,
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: `${styles.spacing.lg} ${styles.spacing.lg} ${styles.spacing.md}`,
            borderBottom: `1px solid ${styles.colors.borderLight}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2
              id="report-modal-title"
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: styles.typography.weightSemibold,
                color: styles.colors.text,
              }}
            >
              Export Job Report
            </h2>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                color: styles.colors.textMuted,
                cursor: 'pointer',
                padding: styles.spacing.xs,
                borderRadius: '4px',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = styles.colors.background;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>

          {!isComplete && (
            <div
              style={{
                marginTop: styles.spacing.sm,
                padding: styles.spacing.sm,
                backgroundColor: '#fff4ce',
                border: '1px solid #ffb900',
                borderRadius: '4px',
                fontSize: styles.typography.fontCaption,
                color: styles.colors.text,
              }}
            >
              ⚠️ Job is still in progress. Export will contain current data only.
            </div>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: styles.spacing.lg,
            overflowY: 'auto',
          }}
        >
          {/* Job Summary */}
          <div
            style={{
              marginBottom: styles.spacing.lg,
              padding: styles.spacing.md,
              backgroundColor: styles.colors.background,
              borderRadius: '6px',
              border: `1px solid ${styles.colors.borderLight}`,
            }}
          >
            <h3
              style={{
                margin: `0 0 ${styles.spacing.sm} 0`,
                fontSize: styles.typography.fontBody,
                fontWeight: styles.typography.weightSemibold,
                color: styles.colors.text,
              }}
            >
              Job Summary
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: styles.spacing.sm,
                fontSize: styles.typography.fontCaption,
                color: styles.colors.textSecondary,
              }}
            >
              <div>
                <strong>Status:</strong> {snapshot.status}
              </div>
              <div>
                <strong>Runtime:</strong> {(() => {
                  if (snapshot.completedAt && snapshot.startedAt) {
                    const runtime = new Date(snapshot.completedAt).getTime() - new Date(snapshot.startedAt).getTime();
                    return `${Math.round(runtime / 1000)}s`;
                  }
                  if (snapshot.startedAt) {
                    const runtime = new Date().getTime() - new Date(snapshot.startedAt).getTime();
                    return `${Math.round(runtime / 1000)}s`;
                  }
                  return '0s';
                })()}
              </div>
              <div>
                <strong>Total Bookmarks:</strong> {summary?.totalBookmarks || 0}
              </div>
              <div>
                <strong>Duplicates Found:</strong> {summary?.duplicatesFound || 0}
              </div>
              <div>
                <strong>Conflicts:</strong> {summary?.conflictsDetected || 0}
              </div>
              <div>
                <strong>Activity Entries:</strong> {activity.length}
              </div>
            </div>
          </div>

          {/* Export Format Selection */}
          <div
            style={{
              marginBottom: styles.spacing.lg,
            }}
          >
            <h3
              style={{
                margin: `0 0 ${styles.spacing.md} 0`,
                fontSize: styles.typography.fontBody,
                fontWeight: styles.typography.weightSemibold,
                color: styles.colors.text,
              }}
            >
              Export Format
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: styles.spacing.sm,
              }}
              role="radiogroup"
              aria-labelledby="export-format-label"
            >
              {(['csv', 'json', 'audit'] as ExportFormat[]).map((format) => (
                <label
                  key={format}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: styles.spacing.sm,
                    padding: styles.spacing.md,
                    border: `1px solid ${selectedFormat === format ? styles.colors.primary : styles.colors.borderLight}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: selectedFormat === format ? '#f0f7ff' : styles.colors.white,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    if (selectedFormat !== format) {
                      e.currentTarget.style.borderColor = styles.colors.border;
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedFormat !== format) {
                      e.currentTarget.style.borderColor = styles.colors.borderLight;
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={format}
                    checked={selectedFormat === format}
                    onChange={(e) => {
                      setSelectedFormat(e.target.value as ExportFormat);
                      resetExport();
                    }}
                    style={{
                      margin: 0,
                      marginTop: '2px',
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: styles.typography.fontBody,
                        fontWeight: styles.typography.weightSemibold,
                        color: styles.colors.text,
                        textTransform: 'uppercase',
                        marginBottom: '2px',
                      }}
                    >
                      {format.toUpperCase()}
                    </div>
                    <div
                      style={{
                        fontSize: styles.typography.fontCaption,
                        color: styles.colors.textMuted,
                        lineHeight: styles.typography.lineCaption,
                      }}
                    >
                      {getFormatDescription(format)}
                    </div>
                    <div
                      style={{
                        fontSize: styles.typography.fontCaption,
                        color: styles.colors.textSecondary,
                        marginTop: '2px',
                      }}
                    >
                      Estimated size: {getEstimatedSize()}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Export Options */}
          <div
            style={{
              marginBottom: styles.spacing.lg,
            }}
          >
            <h3
              style={{
                margin: `0 0 ${styles.spacing.md} 0`,
                fontSize: styles.typography.fontBody,
                fontWeight: styles.typography.weightSemibold,
                color: styles.colors.text,
              }}
            >
              Export Options
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: styles.spacing.sm,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: styles.spacing.sm }}>
                <input
                  type="checkbox"
                  checked={includeActivity}
                  onChange={(e) => setIncludeActivity(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <span style={{ fontSize: styles.typography.fontBody }}>
                  Include activity log
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: styles.spacing.sm }}>
                <input
                  type="checkbox"
                  checked={redactUrls}
                  onChange={(e) => setRedactUrls(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <span style={{ fontSize: styles.typography.fontBody }}>
                  Redact URLs (privacy mode)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: styles.spacing.sm }}>
                <input
                  type="checkbox"
                  checked={includeTimestamps}
                  onChange={(e) => setIncludeTimestamps(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <span style={{ fontSize: styles.typography.fontBody }}>
                  Include timestamps
                </span>
              </label>
            </div>
          </div>

          {/* Status and Error Messages */}
          {exportStatus === 'generating' && (
            <div
              style={{
                padding: styles.spacing.md,
                backgroundColor: '#e6f3ff',
                border: `1px solid ${styles.colors.primary}`,
                borderRadius: '6px',
                textAlign: 'center',
                color: styles.colors.primary,
              }}
            >
              <div style={{ marginBottom: styles.spacing.sm }}>Generating export...</div>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: styles.colors.borderLight,
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: styles.colors.primary,
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          )}

          {exportStatus === 'error' && (
            <div
              role="alert"
              style={{
                padding: styles.spacing.md,
                backgroundColor: '#fde7e9',
                border: `1px solid ${styles.colors.danger}`,
                borderRadius: '6px',
                color: styles.colors.danger,
              }}
            >
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          {exportStatus === 'ready' && exportData && (
            <div
              style={{
                padding: styles.spacing.md,
                backgroundColor: '#e8f5e8',
                border: `1px solid ${styles.colors.success}`,
                borderRadius: '6px',
                color: styles.colors.success,
                textAlign: 'center',
              }}
            >
              <div style={{ marginBottom: styles.spacing.sm }}>
                ✅ Export ready! File: {exportData.filename}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            padding: styles.spacing.lg,
            borderTop: `1px solid ${styles.colors.borderLight}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: styles.spacing.sm,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: `${styles.spacing.sm} ${styles.spacing.lg}`,
              fontSize: styles.typography.fontBody,
              fontWeight: styles.typography.weightSemibold,
              color: styles.colors.textSecondary,
              backgroundColor: styles.colors.white,
              border: `1px solid ${styles.colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = styles.colors.background;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = styles.colors.white;
            }}
          >
            Cancel
          </button>

          {exportStatus === 'idle' && (
            <button
              onClick={handleExport}
              style={{
                padding: `${styles.spacing.sm} ${styles.spacing.lg}`,
                fontSize: styles.typography.fontBody,
                fontWeight: styles.typography.weightSemibold,
                color: styles.colors.white,
                backgroundColor: styles.colors.primary,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = styles.colors.primaryHover;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = styles.colors.primary;
              }}
            >
              Generate Export
            </button>
          )}

          {exportStatus === 'ready' && (
            <button
              onClick={handleDownload}
              style={{
                padding: `${styles.spacing.sm} ${styles.spacing.lg}`,
                fontSize: styles.typography.fontBody,
                fontWeight: styles.typography.weightSemibold,
                color: styles.colors.white,
                backgroundColor: styles.colors.success,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#0e5a0e';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = styles.colors.success;
              }}
            >
              Download Report
            </button>
          )}

          {exportStatus === 'error' && (
            <button
              onClick={handleExport}
              style={{
                padding: `${styles.spacing.sm} ${styles.spacing.lg}`,
                fontSize: styles.typography.fontBody,
                fontWeight: styles.typography.weightSemibold,
                color: styles.colors.white,
                backgroundColor: styles.colors.warning,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#e67300';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = styles.colors.warning;
              }}
            >
              Try Again
            </button>
          )}
        </div>

        {/* Add pulse animation */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}