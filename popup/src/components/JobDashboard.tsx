import { useState } from 'react';
import { useJob } from '../hooks/useJob';
import { StageList } from './StageList';
import { ActivityFeed } from './ActivityFeed';
import { MetricsPanel } from './MetricsPanel';
import { ReportModal } from './ReportModal';
import { JobHistory } from './JobHistory';

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
    warning: '#ff8c00',
    border: '#c7c7c7',
    borderLight: '#e0e0e0',
    background: '#f9f9f9',
    white: '#ffffff',
  },
} as const;

interface JobDashboardProps {
  compact?: boolean;
  showReportButton?: boolean;
}

export function JobDashboard({
  compact = false,
  showReportButton = true
}: JobDashboardProps) {
  const { snapshot, isComplete, isFailed } = useJob();
  const [activeView, setActiveView] = useState<'overview' | 'stages' | 'activity' | 'metrics' | 'history'>('overview');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Don't render if no job is active
  if (!snapshot) {
    return (
      <div
        style={{
          padding: styles.spacing.lg,
          textAlign: 'center',
          color: styles.colors.textMuted,
          fontSize: styles.typography.fontBody,
        }}
      >
        No job in progress
      </div>
    );
  }

  const showViewControls = !compact;
  const maxHeight = compact ? '300px' : '600px';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: compact ? 'auto' : maxHeight,
        backgroundColor: styles.colors.white,
        borderRadius: '8px',
        border: `1px solid ${styles.colors.borderLight}`,
        overflow: 'hidden',
      }}
      role="region"
      aria-label="Job dashboard"
    >
      {/* Header with View Controls */}
      {(showViewControls || showReportButton) && (
        <div
          style={{
            padding: `${styles.spacing.md} ${styles.spacing.lg}`,
            borderBottom: `1px solid ${styles.colors.borderLight}`,
            backgroundColor: styles.colors.background,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: styles.typography.fontBody,
              fontWeight: styles.typography.weightSemibold,
              color: styles.colors.text,
            }}
          >
            Job Progress Dashboard
          </div>

          <div
            style={{
              display: 'flex',
              gap: styles.spacing.sm,
              alignItems: 'center',
            }}
          >
            {/* View Controls */}
            {showViewControls && (
              <div
                style={{
                  display: 'flex',
                  gap: styles.spacing.xs,
                  backgroundColor: styles.colors.white,
                  padding: styles.spacing.xs,
                  borderRadius: '6px',
                  border: `1px solid ${styles.colors.borderLight}`,
                }}
                role="tablist"
                aria-label="Dashboard views"
              >
                {[
                  { key: 'overview', label: 'Overview' },
                  { key: 'stages', label: 'Stages' },
                  { key: 'activity', label: 'Activity' },
                  { key: 'metrics', label: 'Metrics' },
                  { key: 'history', label: 'History' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveView(key as 'overview' | 'stages' | 'activity' | 'metrics' | 'history')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveView(key as 'overview' | 'stages' | 'activity' | 'metrics' | 'history');
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        const views: Array<'overview' | 'stages' | 'activity' | 'metrics' | 'history'> = ['overview', 'stages', 'activity', 'metrics', 'history'];
                        const currentIndex = views.indexOf(key as any);
                        let nextIndex;
                        
                        if (e.key === 'ArrowLeft') {
                          nextIndex = (currentIndex - 1 + views.length) % views.length;
                        } else { // ArrowRight
                          nextIndex = (currentIndex + 1) % views.length;
                        }
                        
                        setActiveView(views[nextIndex]);
                      }
                    }}
                    style={{
                      padding: `${styles.spacing.xs} ${styles.spacing.sm}`,
                      fontSize: styles.typography.fontCaption,
                      fontWeight: styles.typography.weightSemibold,
                      color: activeView === key ? styles.colors.white : styles.colors.textSecondary,
                      backgroundColor: activeView === key ? styles.colors.primary : 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseOver={(e) => {
                      if (activeView !== key) {
                        e.currentTarget.style.backgroundColor = styles.colors.background;
                      }
                    }}
                    onMouseOut={(e) => {
                      if (activeView !== key) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    role="tab"
                    aria-selected={activeView === key}
                    aria-controls={`${key}-panel`}
                    tabIndex={activeView === key ? 0 : -1}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Report Button */}
            {showReportButton && (isComplete || isFailed) && (
              <button
                onClick={() => setIsReportModalOpen(true)}
                style={{
                  padding: `${styles.spacing.xs} ${styles.spacing.md}`,
                  fontSize: styles.typography.fontCaption,
                  fontWeight: styles.typography.weightSemibold,
                  color: styles.colors.white,
                  backgroundColor: styles.colors.primary,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = styles.colors.primaryHover;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = styles.colors.primary;
                }}
                aria-label="Generate job report"
              >
                📊 Report
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Overview View - Grid Layout */}
        {activeView === 'overview' && (
          <div
            id="overview-panel"
            role="tabpanel"
            style={{
              height: '100%',
              display: 'grid',
              gridTemplateColumns: compact ? '1fr' : '1fr 1fr',
              gridTemplateRows: compact ? 'auto auto' : 'auto 1fr',
              gap: styles.spacing.lg,
              padding: styles.spacing.lg,
              overflow: 'hidden',
            }}
          >
            {/* Stage List - Top */}
            <div
              style={{
                gridColumn: compact ? '1' : '1 / 3',
                gridRow: '1',
                height: compact ? 'auto' : '200px',
              }}
            >
              <StageList
                showProgress={true}
                showEstimatedTime={false}
                compact={compact}
              />
            </div>

            {/* Activity Feed - Bottom Left */}
            <div
              style={{
                gridColumn: '1',
                gridRow: '2',
                overflow: 'hidden',
              }}
            >
              <ActivityFeed
                maxEntries={compact ? 10 : 20}
                compact={compact}
                showFilters={false}
              />
            </div>

            {/* Metrics Panel - Bottom Right */}
            <div
              style={{
                gridColumn: '2',
                gridRow: '2',
                overflow: 'hidden',
              }}
            >
              <MetricsPanel
                showHistorical={false}
                showPerformance={true}
                compact={compact}
              />
            </div>
          </div>
        )}

        {/* Individual Views */}
        {activeView === 'stages' && (
          <div
            id="stages-panel"
            role="tabpanel"
            style={{
              height: '100%',
              overflow: 'auto',
              padding: styles.spacing.lg,
            }}
          >
            <StageList
              showProgress={true}
              showEstimatedTime={true}
              compact={false}
            />
          </div>
        )}

        {activeView === 'activity' && (
          <div
            id="activity-panel"
            role="tabpanel"
            style={{
              height: '100%',
              overflow: 'hidden',
              padding: styles.spacing.lg,
            }}
          >
            <ActivityFeed
              maxEntries={100}
              compact={false}
              showFilters={true}
            />
          </div>
        )}

        {activeView === 'metrics' && (
          <div
            id="metrics-panel"
            role="tabpanel"
            style={{
              height: '100%',
              overflow: 'auto',
              padding: styles.spacing.lg,
            }}
          >
            <MetricsPanel
              showHistorical={true}
              showPerformance={true}
              compact={false}
            />
          </div>
        )}
        {activeView === 'history' && (
          <div
            id="history-panel"
            role="tabpanel"
            style={{
              height: '100%',
              overflow: 'auto',
              padding: 0, // JobHistory component handles its own padding
            }}
          >
            <JobHistory />
          </div>
        )}
      </div>

      {/* Report Modal */}
      {isReportModalOpen && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
    </div>
  );
}

// Compact version for inline display
export function CompactJobDashboard() {
  return (
    <JobDashboard
      compact={true}
      showReportButton={false}
    />
  );
}

// Enhanced version for dedicated job view page
export function FullJobDashboard() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: styles.colors.background,
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: styles.spacing.lg,
          padding: styles.spacing.lg,
          overflow: 'auto',
        }}
      >
        <JobDashboard
          compact={false}
          showReportButton={true}
        />
      </div>
    </div>
  );
}