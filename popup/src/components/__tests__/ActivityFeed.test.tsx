import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ActivityFeed } from '../Phase2Panels';
import * as useJobModule from '../../hooks/useJob';

afterEach(() => {
  vi.clearAllMocks();
});

describe('[ActivityFeed](popup/src/components/Phase2Panels.tsx:1)', () => {
  it('renders empty state when no activity', () => {
    vi.spyOn(useJobModule, 'useJob').mockReturnValue({
      snapshot: null,
      activity: [],
      isConnected: true,
      error: null,
      dispatch: vi.fn(),
      refreshStatus: vi.fn(),
      isRunning: false,
      isPaused: false,
      isActive: false,
      isComplete: false,
      isFailed: false,
      isCancelled: false,
      progress: 0,
      currentStage: null,
      currentActivity: null,
    } as unknown as ReturnType<typeof useJobModule.useJob>);

    render(<ActivityFeed />);

    // Heading
    expect(screen.getByRole('heading', { name: /Activity/i })).toBeInTheDocument();
    // Empty caption
    expect(screen.getByText(/No recent activity/i)).toBeInTheDocument();
  });

  it('renders items with severity, timestamp, and stage/context details', () => {
    const now = new Date().toISOString();
    const activity = [
      {
        jobId: 'job-1',
        timestamp: now,
        level: 'info' as const,
        message: 'Job started',
        stage: 'initializing',
      },
      {
        jobId: 'job-1',
        timestamp: now,
        level: 'error' as const,
        message: 'Stage failed',
        stage: 'verifying',
        context: { code: 500, reason: 'timeout' },
      },
    ];

    vi.spyOn(useJobModule, 'useJob').mockReturnValue({
      snapshot: {
        jobId: 'job-1',
        status: 'running',
        stage: 'initializing',
        stageIndex: 0,
        stageUnits: { processed: 0, total: 1 },
        weightedPercent: 0,
        indeterminate: true,
        activity: 'Starting…',
        timestamp: now,
        createdAt: now,
        startedAt: now,
        completedAt: null,
      },
      activity,
      isConnected: true,
      error: null,
      dispatch: vi.fn(),
      refreshStatus: vi.fn(),
      isRunning: true,
      isPaused: false,
      isActive: true,
      isComplete: false,
      isFailed: false,
      isCancelled: false,
      progress: 0,
      currentStage: 'initializing',
      currentActivity: 'Starting…',
    } as unknown as ReturnType<typeof useJobModule.useJob>);

    render(<ActivityFeed />);

    // Heading present
    expect(screen.getByRole('heading', { name: /Activity/i })).toBeInTheDocument();

    // Messages visible
    expect(screen.getByText('Job started')).toBeInTheDocument();
    expect(screen.getByText('Stage failed')).toBeInTheDocument();

    // Severity labels (note: visually uppercased via CSS but underlying text is lower-case)
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();

    // Stage mapping uses friendly names
    expect(screen.getByText(/Stage: Initializing/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage: Verifying/i)).toBeInTheDocument();

    // Context printed as JSON string
    expect(screen.getByText(/"code":\s*500/)).toBeInTheDocument();
    expect(screen.getByText(/"reason":\s*"timeout"/)).toBeInTheDocument();

    // No empty state
    expect(screen.queryByText(/No recent activity/i)).not.toBeInTheDocument();
  });
});