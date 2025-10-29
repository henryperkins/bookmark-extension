import { CSSProperties } from 'react';
import { useJob } from '../hooks/useJob';
import { useActivityFeed } from '../hooks/useActivityFeed';

// Local design tokens (align with App.tsx)
const styles = {
  typography: {
    fontCaption: '12px',
    fontBody: '14px',
    fontBodyLarge: '18px',
    weightRegular: 400,
    weightSemibold: 600,
    lineCaption: '16px',
    lineBody: '20px',
    lineBodyLarge: '24px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },
  colors: {
    text: '#1a1a1a',
    textSecondary: '#555',
    textMuted: '#666',
    primary: '#0078d4',
    success: '#107c10',
    danger: '#d13438',
    border: '#c7c7c7',
    borderLight: '#e0e0e0',
    background: '#f9f9f9',
    white: '#ffffff',
  },
} as const;

// Stage display names (keep in sync with header)
const STAGE_NAMES: Record<string, string> = {
  initializing: 'Initializing',
  scanning: 'Scanning',
  grouping: 'Grouping',
  resolving: 'Resolving',
  verifying: 'Verifying',
  summarizing: 'Summarizing',
  testingConnection: 'Testing Connection',
};

function StageBadge({ status }: { status: 'completed' | 'active' | 'pending' }) {
  const palette = {
    completed: styles.colors.success,
    active: styles.colors.primary,
    pending: styles.colors.textMuted,
  } as const;
  const color = palette[status];
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        marginRight: styles.spacing.sm,
      }}
      aria-hidden="true"
    />
  );
}

export function StageList() {
  const { snapshot } = useJob();

  if (!snapshot) {
    return null;
  }

  const stages = Array.isArray((snapshot as any).stageOrder) && (snapshot as any).stageOrder.length
    ? (snapshot as any).stageOrder as string[]
    : ['initializing', 'scanning', 'grouping', 'resolving', 'verifying', 'summarizing'];

  const currentIndex = typeof snapshot.stageIndex === 'number' ? snapshot.stageIndex : Math.max(stages.indexOf(snapshot.stage), 0);
  const processed = snapshot.stageUnits?.processed ?? 0;
  const total = snapshot.stageUnits?.total ?? null;
  const showNumeric = typeof total === 'number' && total > 0;

  return (
    <section aria-label="Stages" style={{ padding: styles.spacing.lg }}>
      <h3
        style={{
          fontSize: styles.typography.fontBodyLarge,
          lineHeight: styles.typography.lineBodyLarge,
          fontWeight: styles.typography.weightSemibold,
          color: styles.colors.text,
          margin: 0,
          marginBottom: styles.spacing.md,
        }}
      >
        Stages
      </h3>

      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {stages.map((s, i) => {
          const status: 'completed' | 'active' | 'pending' =
            i < currentIndex ? 'completed' : i === currentIndex ? 'active' : 'pending';
          const label = STAGE_NAMES[s] || s;
          const isActive = status === 'active';
          const rowBg = i % 2 === 0 ? styles.colors.white : styles.colors.background;

          return (
            <li
              key={s}
              role="listitem"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: `1px solid ${styles.colors.borderLight}`,
                borderRadius: 4,
                padding: styles.spacing.sm,
                marginBottom: styles.spacing.xs,
                background: rowBg,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <StageBadge status={status} />
                <div style={{ color: styles.colors.text, fontSize: styles.typography.fontBody, fontWeight: styles.typography.weightSemibold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </div>
              </div>

              {/* Progress cell */}
              <div style={{ marginLeft: styles.spacing.sm, flex: 1, minWidth: 0 }}>
                <div
                  aria-hidden={!isActive}
                  aria-label={isActive ? `${label} progress` : undefined}
                  style={{
                    height: 6,
                    background: styles.colors.borderLight,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: isActive
                        ? showNumeric
                          ? `${Math.max(0, Math.min(100, Math.round((processed / Math.max(1, total as number)) * 100)))}%`
                          : '100%'
                        : status === 'completed'
                          ? '100%'
                          : '0%',
                      background: status === 'completed'
                        ? styles.colors.success
                        : isActive
                          ? styles.colors.primary
                          : styles.colors.border,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
                {isActive && showNumeric && (
                  <div
                    style={{
                      marginTop: styles.spacing.xs,
                      fontSize: styles.typography.fontCaption,
                      color: styles.colors.textMuted,
                      textAlign: 'right',
                    }}
                  >
                    {processed}/{total}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Reduced motion preference style */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          div[style*="transition: width"] {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}

export function ActivityFeed() {
  const { items, isEmpty } = useActivityFeed();

  return (
    <section aria-label="Activity" style={{ padding: styles.spacing.lg }}>
      <h3
        style={{
          fontSize: styles.typography.fontBodyLarge,
          lineHeight: styles.typography.lineBodyLarge,
          fontWeight: styles.typography.weightSemibold,
          color: styles.colors.text,
          margin: 0,
          marginBottom: styles.spacing.md,
        }}
      >
        Activity
      </h3>

      {isEmpty ? (
        <p style={{ color: styles.colors.textMuted, fontSize: styles.typography.fontBody, lineHeight: styles.typography.lineBody }}>
          No recent activity
        </p>
      ) : (
        <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((a) => {
            const levelColor =
              a.level === 'error'
                ? styles.colors.danger
                : a.level === 'warn'
                  ? '#eaa300' // warning amber
                  : styles.colors.textSecondary;

            const rowStyle: CSSProperties = {
              border: `1px solid ${styles.colors.borderLight}`,
              borderRadius: 4,
              padding: styles.spacing.sm,
              marginBottom: styles.spacing.xs,
              background: styles.colors.white,
            };

            return (
              <li key={a.id} role="listitem" style={rowStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: styles.spacing.sm }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: styles.spacing.sm, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        minWidth: 56,
                        fontSize: styles.typography.fontCaption,
                        color: styles.colors.textMuted,
                      }}
                    >
                      {a.timeText}
                    </span>
                    <strong
                      style={{
                        fontSize: styles.typography.fontBody,
                        color: styles.colors.text,
                        fontWeight: styles.typography.weightSemibold,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {a.message}
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: styles.typography.fontCaption,
                      color: levelColor,
                      fontWeight: styles.typography.weightSemibold,
                      textTransform: 'uppercase',
                    }}
                    aria-label={`severity ${a.level}`}
                  >
                    {a.level}
                  </span>
                </div>
                {(a.stage || a.context) && (
                  <div
                    style={{
                      marginTop: styles.spacing.xs,
                      fontSize: styles.typography.fontCaption,
                      color: styles.colors.textMuted,
                      lineHeight: styles.typography.lineCaption,
                      wordBreak: 'break-word',
                    }}
                  >
                    {a.stage ? `Stage: ${STAGE_NAMES[a.stage] || a.stage}` : null}
                    {a.stage && a.context ? ' — ' : ''}
                    {a.context ? JSON.stringify(a.context) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function MetricsPanel() {
  const { snapshot, isComplete, isFailed } = useJob();

  if (!snapshot?.summary) {
    return null;
  }

  const s = snapshot.summary as Record<string, any>;

  const card: CSSProperties = {
    border: `1px solid ${styles.colors.borderLight}`,
    borderRadius: 4,
    padding: styles.spacing.md,
    background: styles.colors.white,
    minWidth: 0,
  };

  const title: CSSProperties = {
    fontSize: styles.typography.fontCaption,
    color: styles.colors.textMuted,
    margin: 0,
    marginBottom: styles.spacing.xs,
  };

  const value: CSSProperties = {
    fontSize: styles.typography.fontBodyLarge,
    lineHeight: styles.typography.lineBodyLarge,
    fontWeight: styles.typography.weightSemibold,
    color: styles.colors.text,
  };

  return (
    <section aria-label="Metrics" style={{ padding: styles.spacing.lg }}>
      <h3
        style={{
          fontSize: styles.typography.fontBodyLarge,
          lineHeight: styles.typography.lineBodyLarge,
          fontWeight: styles.typography.weightSemibold,
          color: isFailed ? styles.colors.danger : isComplete ? styles.colors.success : styles.colors.text,
          margin: 0,
          marginBottom: styles.spacing.md,
        }}
      >
        {isFailed ? 'Failed' : isComplete ? 'Completed' : 'Metrics'}
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: styles.spacing.sm,
        }}
      >
        {'totalBookmarks' in s && (
          <div style={card}>
            <p style={title}>Total bookmarks</p>
            <div style={value}>{s.totalBookmarks}</div>
          </div>
        )}
        {'duplicatesFound' in s && (
          <div style={card}>
            <p style={title}>Duplicates found</p>
            <div style={value}>{s.duplicatesFound}</div>
          </div>
        )}
        {'duplicatesResolved' in s && (
          <div style={card}>
            <p style={title}>Duplicates resolved</p>
            <div style={value}>{s.duplicatesResolved}</div>
          </div>
        )}
        {'reviewQueueSize' in s && (
          <div style={card}>
            <p style={title}>Review queue</p>
            <div style={value}>{s.reviewQueueSize}</div>
          </div>
        )}
        {'runtimeMs' in s && (
          <div style={card}>
            <p style={title}>Runtime</p>
            <div style={value}>{Math.round((s.runtimeMs as number) / 1000)}s</div>
          </div>
        )}
      </div>
    </section>
  );
}