import { useJob } from '../hooks/useJob';

// Design system (matching ProgressHeader and App.tsx)
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

// Activity level configuration
const ACTIVITY_CONFIG = {
  info: {
    icon: 'ℹ️',
    color: styles.colors.textSecondary,
    bgColor: '#f0f7ff',
  },
  warn: {
    icon: '⚠️',
    color: styles.colors.warning,
    bgColor: '#fff8e6',
  },
  error: {
    icon: '❌',
    color: styles.colors.danger,
    bgColor: '#fde7e9',
  },
} as const;

interface ActivityFeedProps {
  maxEntries?: number;
  showFilters?: boolean;
  compact?: boolean;
}

export function ActivityFeed({
  maxEntries = 50,
  showFilters = true,
  compact = false
}: ActivityFeedProps) {
  const { activity, snapshot } = useJob();

  // Filter and limit activity entries
  const displayedActivity = activity
    .slice(-maxEntries)
    .reverse(); // Show newest first

  if (!snapshot || displayedActivity.length === 0) {
    return (
      <div
        style={{
          padding: styles.spacing.lg,
          textAlign: 'center',
          color: styles.colors.textMuted,
          fontSize: styles.typography.fontCaption,
        }}
      >
        No activity to display
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: compact ? 'auto' : '100%',
        maxHeight: compact ? '200px' : '400px',
        overflow: 'hidden',
      }}
      role="region"
      aria-label="Job activity feed"
      aria-live="polite"
    >
      {/* Header */}
      <div
        style={{
          padding: `${styles.spacing.md} ${styles.spacing.lg}`,
          borderBottom: `1px solid ${styles.colors.borderLight}`,
          backgroundColor: styles.colors.white,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: styles.typography.fontBody,
              fontWeight: styles.typography.weightSemibold,
              color: styles.colors.text,
            }}
          >
            Activity Log
          </h3>
          <span
            style={{
              fontSize: styles.typography.fontCaption,
              color: styles.colors.textMuted,
            }}
          >
            {displayedActivity.length} entries
          </span>
        </div>
      </div>

      {/* Activity entries */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: styles.spacing.sm,
          backgroundColor: styles.colors.background,
        }}
      >
        {displayedActivity.map((entry, index) => {
          const config = ACTIVITY_CONFIG[entry.level];
          const timestamp = new Date(entry.timestamp);
          const timeString = timestamp.toLocaleTimeString();
          const dateString = timestamp.toLocaleDateString();

          return (
            <div
              key={`${entry.timestamp}-${index}`}
              style={{
                display: 'flex',
                gap: styles.spacing.sm,
                padding: styles.spacing.sm,
                marginBottom: styles.spacing.xs,
                backgroundColor: styles.colors.white,
                borderRadius: '6px',
                border: `1px solid ${styles.colors.borderLight}`,
                fontSize: compact ? styles.typography.fontCaption : styles.typography.fontBody,
                lineHeight: compact ? styles.typography.lineCaption : styles.typography.lineBody,
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = styles.colors.border;
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = styles.colors.borderLight;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Activity icon */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  fontSize: '12px',
                  backgroundColor: config.bgColor,
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
                aria-hidden="true"
              >
                {config.icon}
              </div>

              {/* Activity content */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0, // Allows text truncation
                }}
              >
                {/* Message */}
                <div
                  style={{
                    color: config.color,
                    fontWeight: styles.typography.weightSemibold,
                    marginBottom: '2px',
                    wordBreak: 'break-word',
                  }}
                >
                  {entry.message}
                </div>

                {/* Metadata row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: styles.spacing.sm,
                    fontSize: styles.typography.fontCaption,
                    color: styles.colors.textMuted,
                  }}
                >
                  {/* Stage info */}
                  {entry.stage && (
                    <span
                      style={{
                        backgroundColor: styles.colors.background,
                        padding: '2px 6px',
                        borderRadius: '3px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {entry.stage.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  )}

                  {/* Timestamp */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '1px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{timeString}</span>
                    {!compact && (
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>
                        {dateString}
                      </span>
                    )}
                  </div>
                </div>

                {/* Context information */}
                {entry.context && Object.keys(entry.context).length > 0 && (
                  <details
                    style={{
                      marginTop: styles.spacing.xs,
                      fontSize: styles.typography.fontCaption,
                    }}
                  >
                    <summary
                      style={{
                        cursor: 'pointer',
                        color: styles.colors.textSecondary,
                        outline: 'none',
                      }}
                    >
                      Details
                    </summary>
                    <div
                      style={{
                        marginTop: styles.spacing.xs,
                        padding: styles.spacing.xs,
                        backgroundColor: styles.colors.background,
                        borderRadius: '3px',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '100px',
                        overflowY: 'auto',
                      }}
                    >
                      {JSON.stringify(entry.context, null, 2)}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyboard navigation hint */}
      <div
        style={{
          padding: styles.spacing.sm,
          backgroundColor: styles.colors.white,
          borderTop: `1px solid ${styles.colors.borderLight}`,
          fontSize: styles.typography.fontCaption,
          color: styles.colors.textMuted,
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        Scroll for more • Press <kbd>Space</kbd> to pause
      </div>
    </div>
  );
}

// Enhanced version with filtering capabilities
export function FilteredActivityFeed({ maxEntries = 100 }: { maxEntries?: number }) {
  const { activity } = useJob();
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredActivity = activity
    .filter(entry => {
      if (selectedLevel !== 'all' && entry.level !== selectedLevel) {
        return false;
      }
      if (searchQuery && !entry.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    })
    .slice(-maxEntries)
    .reverse();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Filters */}
      <div
        style={{
          padding: styles.spacing.md,
          backgroundColor: styles.colors.white,
          borderBottom: `1px solid ${styles.colors.borderLight}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: styles.spacing.md,
            alignItems: 'center',
            marginBottom: styles.spacing.sm,
          }}
        >
          <label
            style={{
              fontSize: styles.typography.fontCaption,
              fontWeight: styles.typography.weightSemibold,
              color: styles.colors.text,
            }}
          >
            Filter:
          </label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: styles.typography.fontCaption,
              border: `1px solid ${styles.colors.border}`,
              borderRadius: '4px',
              backgroundColor: styles.colors.white,
            }}
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>

          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: styles.typography.fontCaption,
              border: `1px solid ${styles.colors.border}`,
              borderRadius: '4px',
              backgroundColor: styles.colors.white,
            }}
          />
        </div>

        <div
          style={{
            fontSize: styles.typography.fontCaption,
            color: styles.colors.textMuted,
          }}
        >
          Showing {filteredActivity.length} of {activity.length} entries
        </div>
      </div>

      {/* Activity feed */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ActivityFeed
          maxEntries={maxEntries}
          showFilters={false}
          compact={false}
        />
      </div>
    </div>
  );
}

// Add useState import
import { useState } from 'react';