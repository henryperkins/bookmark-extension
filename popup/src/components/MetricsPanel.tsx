import { useJob } from '../hooks/useJob';

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
    success: '#107c10',
    danger: '#d13438',
    warning: '#ff8c00',
    border: '#c7c7c7',
    borderLight: '#e0e0e0',
    background: '#f9f9f9',
    white: '#ffffff',
  },
} as const;

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

function MetricCard({
  title,
  value,
  subtitle,
  color = styles.colors.text,
  icon,
  trend,
  trendValue
}: MetricCardProps) {
  const trendColors = {
    up: styles.colors.success,
    down: styles.colors.danger,
    stable: styles.colors.textMuted,
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
  };

  return (
    <div
      style={{
        padding: styles.spacing.md,
        backgroundColor: styles.colors.white,
        border: `1px solid ${styles.colors.borderLight}`,
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: styles.spacing.sm,
        transition: 'all 0.2s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = styles.colors.border;
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = styles.colors.borderLight;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            fontSize: styles.typography.fontCaption,
            color: styles.colors.textMuted,
            fontWeight: styles.typography.weightSemibold,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {title}
        </div>

        {icon && (
          <div
            style={{
              fontSize: '16px',
              opacity: 0.7,
            }}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: '24px',
          fontWeight: styles.typography.weightSemibold,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div
          style={{
            fontSize: styles.typography.fontCaption,
            color: styles.colors.textMuted,
          }}
        >
          {subtitle}
        </div>
      )}

      {/* Trend */}
      {trend && trendValue && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: styles.spacing.xs,
            fontSize: styles.typography.fontCaption,
            color: trendColors[trend],
            fontWeight: styles.typography.weightSemibold,
          }}
        >
          <span>{trendIcons[trend]}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}

interface MetricsPanelProps {
  showHistorical?: boolean;
  showPerformance?: boolean;
  compact?: boolean;
}

export function MetricsPanel({
  showHistorical = false,
  showPerformance = true,
  compact = false
}: MetricsPanelProps) {
  const { snapshot, activity } = useJob();

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
        No metrics available
      </div>
    );
  }

  const summary = snapshot.summary;
  const isActive = ['queued', 'running', 'paused'].includes(snapshot.status);
  const isComplete = snapshot.status === 'completed';

  // Calculate derived metrics
  const calculateRuntimeMs = () => {
    if (snapshot.completedAt && snapshot.startedAt) {
      return new Date(snapshot.completedAt).getTime() - new Date(snapshot.startedAt).getTime();
    }
    if (snapshot.startedAt) {
      return new Date().getTime() - new Date(snapshot.startedAt).getTime();
    }
    return 0;
  };

  const runtimeMs = calculateRuntimeMs();
  const runtimeSeconds = Math.round(runtimeMs / 1000);
  const runtimeFormatted = formatDuration(runtimeSeconds);
  const processingRate = summary?.totalBookmarks && runtimeSeconds > 0
    ? (summary.totalBookmarks / runtimeSeconds).toFixed(1)
    : '0';

  // Calculate success rates
  const duplicateResolutionRate = summary?.duplicatesFound && summary?.duplicatesFound > 0
    ? Math.round((summary.duplicatesResolved / summary.duplicatesFound) * 100)
    : 0;

  const conflictResolutionRate = summary?.conflictsDetected && summary?.conflictsDetected > 0
    ? Math.round((summary.conflictsResolved / summary?.conflictsDetected) * 100)
    : 0;

  // Get error count from activity
  const errorCount = activity.filter(entry => entry.level === 'error').length;
  const warningCount = activity.filter(entry => entry.level === 'warn').length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: styles.spacing.lg,
      }}
      role="region"
      aria-label="Job metrics and statistics"
    >
      {/* Primary Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: styles.spacing.md,
        }}
      >
        {/* Total Bookmarks */}
        <MetricCard
          title="Total Bookmarks"
          value={summary?.totalBookmarks || 0}
          subtitle="Processed in this job"
          icon="📚"
          color={styles.colors.primary}
        />

        {/* Duplicates Found */}
        <MetricCard
          title="Duplicates Found"
          value={summary?.duplicatesFound || 0}
          subtitle={`${summary?.duplicatesResolved || 0} resolved`}
          icon="🔍"
          color={summary?.duplicatesFound ? styles.colors.warning : styles.colors.text}
          trend={summary?.duplicatesFound ? 'stable' : undefined}
          trendValue={duplicateResolutionRate > 0 ? `${duplicateResolutionRate}% resolved` : undefined}
        />

        {/* Conflicts */}
        <MetricCard
          title="Sync Conflicts"
          value={summary?.conflictsDetected || 0}
          subtitle={`${summary?.conflictsResolved || 0} resolved`}
          icon="⚠️"
          color={summary?.conflictsDetected ? styles.colors.danger : styles.colors.text}
          trend={summary?.conflictsDetected ? 'stable' : undefined}
          trendValue={conflictResolutionRate > 0 ? `${conflictResolutionRate}% resolved` : undefined}
        />

        {/* Review Queue */}
        <MetricCard
          title="Review Queue"
          value={summary?.reviewQueueSize || 0}
          subtitle="Pending manual review"
          icon="📋"
          color={summary?.reviewQueueSize ? styles.colors.warning : styles.colors.success}
        />
      </div>

      {/* Performance Metrics */}
      {showPerformance && (
        <div>
          <h3
            style={{
              margin: `0 0 ${styles.spacing.md} 0`,
              fontSize: styles.typography.fontBody,
              fontWeight: styles.typography.weightSemibold,
              color: styles.colors.text,
            }}
          >
            Performance
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: styles.spacing.md,
            }}
          >
            {/* Runtime */}
            <MetricCard
              title="Runtime"
              value={runtimeFormatted}
              subtitle={isComplete ? 'Total duration' : 'So far'}
              icon="⏱️"
              color={styles.colors.textSecondary}
            />

            {/* Processing Rate */}
            <MetricCard
              title="Processing Rate"
              value={`${processingRate}/s`}
              subtitle="Bookmarks per second"
              icon="⚡"
              color={styles.colors.success}
            />

            {/* Average Similarity */}
            {summary?.averageSimilarity !== undefined && (
              <MetricCard
                title="Avg Similarity"
                value={`${Math.round(summary.averageSimilarity * 100)}%`}
                subtitle="Duplicate confidence"
                icon="📊"
                color={styles.colors.primary}
              />
            )}

            {/* Auto Applied */}
            <MetricCard
              title="Auto Applied"
              value={summary?.autoApplied ? 'Yes' : 'No'}
              subtitle="Automatic resolution"
              icon="🤖"
              color={summary?.autoApplied ? styles.colors.success : styles.colors.textMuted}
            />
          </div>
        </div>
      )}

      {/* Quality Metrics */}
      <div>
        <h3
          style={{
            margin: `0 0 ${styles.spacing.md} 0`,
            fontSize: styles.typography.fontBody,
            fontWeight: styles.typography.weightSemibold,
            color: styles.colors.text,
          }}
        >
          Quality & Status
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: styles.spacing.md,
          }}
        >
          {/* Errors */}
          <MetricCard
            title="Errors"
            value={errorCount}
            subtitle={errorCount === 0 ? 'No errors' : 'Check activity log'}
            icon="❌"
            color={errorCount === 0 ? styles.colors.success : styles.colors.danger}
          />

          {/* Warnings */}
          <MetricCard
            title="Warnings"
            value={warningCount}
            subtitle={warningCount === 0 ? 'No warnings' : 'Review warnings'}
            icon="⚠️"
            color={warningCount === 0 ? styles.colors.success : styles.colors.warning}
          />

          {/* Tagging Accuracy */}
          {summary?.taggingAccuracy !== undefined && (
            <MetricCard
              title="Tagging Accuracy"
              value={`${Math.round(summary.taggingAccuracy * 100)}%`}
              subtitle="AI tagging quality"
              icon="🏷️"
              color={styles.colors.primary}
            />
          )}

          {/* Job Status */}
          <MetricCard
            title="Job Status"
            value={snapshot.status.replace(/([A-Z])/g, ' $1').trim()}
            subtitle={snapshot.activity}
            icon={getStatusIcon(snapshot.status)}
            color={getStatusColor(snapshot.status)}
          />
        </div>
      </div>

      {/* Summary Stats */}
      {isComplete && summary && (
        <div
          style={{
            padding: styles.spacing.lg,
            backgroundColor: styles.colors.background,
            border: `1px solid ${styles.colors.borderLight}`,
            borderRadius: '8px',
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
            Job Summary
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? '1fr' : 'repeat(2, 1fr)',
              gap: styles.spacing.md,
              fontSize: styles.typography.fontCaption,
              color: styles.colors.textSecondary,
            }}
          >
            <div>
              <strong>Started:</strong> {formatDateTime(summary.startedAt)}
            </div>
            <div>
              <strong>Completed:</strong> {formatDateTime(summary.completedAt)}
            </div>
            <div>
              <strong>Duplicates Resolved:</strong> {summary.duplicatesResolved} of {summary.duplicatesFound}
            </div>
            <div>
              <strong>Conflicts Resolved:</strong> {summary.conflictsResolved} of {summary.conflictsDetected}
            </div>
            <div>
              <strong>Total Processed:</strong> {summary.totalBookmarks} bookmarks
            </div>
            <div>
              <strong>Efficiency:</strong> {processingRate} bookmarks/second
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString();
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    idle: '⏸️',
    queued: '⏳',
    running: '▶️',
    paused: '⏸️',
    cancelling: '⏹️',
    cancelled: '⏹️',
    failed: '❌',
    completed: '✅',
  };
  return icons[status] || '❓';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    idle: styles.colors.textMuted,
    queued: styles.colors.textSecondary,
    running: styles.colors.primary,
    paused: styles.colors.warning,
    cancelling: styles.colors.warning,
    cancelled: styles.colors.textMuted,
    failed: styles.colors.danger,
    completed: styles.colors.success,
  };
  return colors[status] || styles.colors.text;
}