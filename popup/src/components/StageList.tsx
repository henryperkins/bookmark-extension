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

// Stage status colors and icons
const STAGE_STATUS_CONFIG = {
  pending: {
    color: styles.colors.textMuted,
    bgColor: '#f5f5f5',
    icon: '○',
  },
  running: {
    color: styles.colors.primary,
    bgColor: '#e6f3ff',
    icon: '◐',
  },
  completed: {
    color: styles.colors.success,
    bgColor: '#e8f5e8',
    icon: '●',
  },
  failed: {
    color: styles.colors.danger,
    bgColor: '#fde7e9',
    icon: '✕',
  },
  skipped: {
    color: styles.colors.textMuted,
    bgColor: '#f5f5f5',
    icon: '⊘',
  },
} as const;

interface StageListProps {
  showProgress?: boolean;
  showEstimatedTime?: boolean;
  compact?: boolean;
}

export function StageList({
  showProgress = true,
  showEstimatedTime = false,
  compact = false
}: StageListProps) {
  const { snapshot, progress, currentStage } = useJob();

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

  // Get stage order from job snapshot or use default
  const stageOrder = snapshot.stageOrder || [
    'initializing',
    'scanning',
    'grouping',
    'resolving',
    'verifying',
    'summarizing'
  ];

  // Calculate stage status and progress
  const stagesWithStatus = stageOrder.map((stageId, index) => {
    const isCurrentStage = snapshot.stage === stageId;
    const isPastStage = index < (snapshot.stageIndex || 0);
    const isFailed = snapshot.error && isCurrentStage;

    let status: keyof typeof STAGE_STATUS_CONFIG = 'pending';
    if (isFailed) {
      status = 'failed';
    } else if (isCurrentStage && snapshot.status === 'running') {
      status = 'running';
    } else if (isPastStage || (isCurrentStage && snapshot.status === 'completed')) {
      status = 'completed';
    }

    // Calculate stage progress
    let stageProgress = 0;
    if (isCurrentStage && snapshot.stageUnits) {
      const { processed, total } = snapshot.stageUnits;
      if (total && total > 0) {
        stageProgress = Math.min((processed / total) * 100, 100);
      } else if (snapshot.status === 'running') {
        stageProgress = 50; // Indeterminate but running
      }
    } else if (status === 'completed') {
      stageProgress = 100;
    }

    return {
      id: stageId,
      name: getStageDisplayName(stageId),
      description: getStageDescription(stageId),
      status,
      progress: stageProgress,
      isCurrent: isCurrentStage,
      weight: snapshot.stageWeights?.[stageId] || 1,
      estimatedDuration: getEstimatedDuration(stageId),
    };
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: compact ? 'auto' : '100%',
        backgroundColor: styles.colors.white,
        borderRadius: '8px',
        border: `1px solid ${styles.colors.borderLight}`,
        overflow: 'hidden',
      }}
      role="region"
      aria-label="Job stages"
    >
      {/* Header */}
      <div
        style={{
          padding: `${styles.spacing.md} ${styles.spacing.lg}`,
          borderBottom: `1px solid ${styles.colors.borderLight}`,
          backgroundColor: styles.colors.background,
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
          Job Stages
        </h3>
        <div
          style={{
            fontSize: styles.typography.fontCaption,
            color: styles.colors.textMuted,
            marginTop: '2px',
          }}
        >
          Overall Progress: {Math.round(progress)}%
        </div>
      </div>

      {/* Stage list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: styles.spacing.sm,
        }}
      >
        {stagesWithStatus.map((stage, index) => {
          const statusConfig = STAGE_STATUS_CONFIG[stage.status];

          return (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: styles.spacing.md,
                padding: styles.spacing.md,
                marginBottom: styles.spacing.sm,
                backgroundColor: stage.isCurrent ? statusConfig.bgColor : styles.colors.white,
                border: `1px solid ${stage.isCurrent ? statusConfig.color : styles.colors.borderLight}`,
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => {
                if (!stage.isCurrent) {
                  e.currentTarget.style.borderColor = styles.colors.border;
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }
              }}
              onMouseOut={(e) => {
                if (!stage.isCurrent) {
                  e.currentTarget.style.borderColor = styles.colors.borderLight;
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              role="listitem"
              aria-current={stage.isCurrent ? 'step' : undefined}
            >
              {/* Stage indicator */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: styles.spacing.xs,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: statusConfig.bgColor,
                    color: statusConfig.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: styles.typography.weightSemibold,
                    border: `2px solid ${statusConfig.color}`,
                  }}
                  aria-label={`Stage ${index + 1} ${stage.status}`}
                >
                  {statusConfig.icon}
                </div>

                {/* Connecting line */}
                {index < stagesWithStatus.length - 1 && (
                  <div
                    style={{
                      width: '2px',
                      height: '20px',
                      backgroundColor: stage.status === 'completed' ? styles.colors.success : styles.colors.borderLight,
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Stage content */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {/* Stage name and status */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: styles.spacing.xs,
                  }}
                >
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: styles.typography.fontBody,
                        fontWeight: styles.typography.weightSemibold,
                        color: stage.isCurrent ? statusConfig.color : styles.colors.text,
                        textTransform: 'capitalize',
                      }}
                    >
                      {stage.name}
                    </h4>
                    {stage.description && !compact && (
                      <p
                        style={{
                          margin: '2px 0 0 0',
                          fontSize: styles.typography.fontCaption,
                          color: styles.colors.textMuted,
                          lineHeight: styles.typography.lineCaption,
                        }}
                      >
                        {stage.description}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: styles.spacing.xs,
                    }}
                  >
                    {/* Status badge */}
                    <span
                      style={{
                        fontSize: styles.typography.fontCaption,
                        fontWeight: styles.typography.weightSemibold,
                        color: statusConfig.color,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        backgroundColor: statusConfig.bgColor,
                        borderRadius: '3px',
                      }}
                    >
                      {stage.status}
                    </span>

                    {/* Weight indicator */}
                    {stage.weight > 0 && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: styles.colors.textMuted,
                        }}
                      >
                        {stage.weight}% weight
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {showProgress && (stage.status === 'running' || stage.status === 'completed') && (
                  <div
                    style={{
                      marginTop: styles.spacing.sm,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: styles.spacing.xs,
                      }}
                    >
                      <span
                        style={{
                          fontSize: styles.typography.fontCaption,
                          color: styles.colors.textSecondary,
                        }}
                      >
                        Progress
                      </span>
                      <span
                        style={{
                          fontSize: styles.typography.fontCaption,
                          fontWeight: styles.typography.weightSemibold,
                          color: statusConfig.color,
                        }}
                      >
                        {Math.round(stage.progress)}%
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(stage.progress)}
                      aria-valuetext={`${stage.name} stage: ${Math.round(stage.progress)}% complete`}
                      style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: styles.colors.borderLight,
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${stage.progress}%`,
                          backgroundColor: statusConfig.color,
                          transition: 'width 0.3s ease-in-out',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Estimated time */}
                {showEstimatedTime && stage.estimatedDuration && (
                  <div
                    style={{
                      marginTop: styles.spacing.xs,
                      fontSize: styles.typography.fontCaption,
                      color: styles.colors.textMuted,
                    }}
                  >
                    Est. {stage.estimatedDuration}
                  </div>
                )}

                {/* Current stage activity */}
                {stage.isCurrent && snapshot.activity && (
                  <div
                    style={{
                      marginTop: styles.spacing.sm,
                      padding: styles.spacing.sm,
                      backgroundColor: styles.colors.white,
                      border: `1px solid ${styles.colors.borderLight}`,
                      borderRadius: '4px',
                      fontSize: styles.typography.fontCaption,
                      color: styles.colors.textSecondary,
                      fontStyle: 'italic',
                    }}
                  >
                    {snapshot.activity}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall progress summary */}
      <div
        style={{
          padding: styles.spacing.md,
          borderTop: `1px solid ${styles.colors.borderLight}`,
          backgroundColor: styles.colors.background,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: styles.typography.fontCaption,
              color: styles.colors.textMuted,
            }}
          >
            {stagesWithStatus.filter(s => s.status === 'completed').length} of {stagesWithStatus.length} stages completed
          </div>

          <div
            style={{
              fontSize: styles.typography.fontCaption,
              fontWeight: styles.typography.weightSemibold,
              color: styles.colors.primary,
            }}
          >
            {Math.round(progress)}% Complete
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions for stage metadata
function getStageDisplayName(stageId: string): string {
  const displayNames: Record<string, string> = {
    initializing: 'Initializing',
    scanning: 'Scanning Bookmarks',
    grouping: 'Grouping Similar Items',
    resolving: 'Resolving Duplicates',
    verifying: 'Verifying Changes',
    summarizing: 'Summarizing Results',
    testingConnection: 'Testing Connection',
    'parse-html': 'Parsing HTML',
    'create-bookmarks': 'Creating Bookmarks',
    'enrich-bookmarks': 'Enriching Bookmarks',
  };
  return displayNames[stageId] || stageId.replace(/([A-Z])/g, ' $1').trim();
}

function getStageDescription(stageId: string): string {
  const descriptions: Record<string, string> = {
    initializing: 'Preparing the job environment and loading stored state',
    scanning: 'Reading bookmark metadata and building working sets',
    grouping: 'Clustering potential duplicates by similarity',
    resolving: 'Applying dedupe and conflict resolution strategies',
    verifying: 'Double-checking bookmark integrity and sync alignment',
    summarizing: 'Generating completion summary and persisting results',
    testingConnection: 'Pinging the Azure OpenAI endpoint to verify credentials',
    'parse-html': 'Parsing imported HTML file structure',
    'create-bookmarks': 'Creating bookmarks in the browser',
    'enrich-bookmarks': 'Generating tags and enriching bookmark data',
  };
  return descriptions[stageId] || '';
}

function getEstimatedDuration(stageId: string): string {
  const durations: Record<string, string> = {
    initializing: '~5 seconds',
    scanning: '~30 seconds',
    grouping: '~10 seconds',
    resolving: '~1 minute',
    verifying: '~15 seconds',
    summarizing: '~5 seconds',
    testingConnection: '~10 seconds',
    'parse-html': '~10 seconds',
    'create-bookmarks': '~30 seconds',
    'enrich-bookmarks': '~2 minutes',
  };
  return durations[stageId] || '';
}