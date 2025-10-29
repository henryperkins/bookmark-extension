import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProgressHeader } from '../ProgressHeader';
import * as useJobModule from '../../hooks/useJob';

afterEach(() => {
  vi.clearAllMocks();
});

describe('[ProgressHeader](popup/src/components/ProgressHeader.tsx:1)', () => {
  it('renders Running state with Pause/Cancel and correct stage/progress', async () => {
    const dispatch = vi.fn();
    vi.spyOn(useJobModule, 'useJob').mockReturnValue({
      // State
      snapshot: {
        jobId: 'j1',
        status: 'running',
        stage: 'resolving',
        stageIndex: 3,
        stageUnits: { processed: 50, total: 100 },
        weightedPercent: 50,
        indeterminate: false,
        activity: 'Working…',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
      isConnected: true,
      error: null,

      // Actions
      dispatch,
      refreshStatus: vi.fn(),

      // Helpers
      isRunning: true,
      isPaused: false,
      isActive: true,
      isComplete: false,
      isFailed: false,
      isCancelled: false,
      progress: 50,
      currentStage: 'resolving',
      currentActivity: 'Working…',
      activity: [],
    } as unknown as ReturnType<typeof useJobModule.useJob>);

    render(<ProgressHeader />);

    // Status text
    expect(screen.getByText('Running')).toBeInTheDocument();
    // Stage label (allow substring match within "Stage: Resolving")
    expect(screen.getByText(/Stage:/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolving/i)).toBeInTheDocument();

    // Progressbar aria-valuenow matches 50
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');

    // Pause and Cancel present; Resume not present
    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    expect(pauseBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    await userEvent.click(pauseBtn);
    expect(dispatch).toHaveBeenCalledWith('PAUSE_JOB');
  });

  it('renders Paused state with Resume/Cancel', async () => {
    const dispatch = vi.fn();
    vi.spyOn(useJobModule, 'useJob').mockReturnValue({
      snapshot: {
        jobId: 'j2',
        status: 'paused',
        stage: 'scanning',
        stageIndex: 1,
        stageUnits: { processed: 25, total: 100 },
        weightedPercent: 30,
        indeterminate: false,
        activity: 'Paused',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
      isConnected: true,
      error: null,
      dispatch,
      refreshStatus: vi.fn(),
      isRunning: false,
      isPaused: true,
      isActive: true,
      isComplete: false,
      isFailed: false,
      isCancelled: false,
      progress: 30,
      currentStage: 'scanning',
      currentActivity: 'Paused',
      activity: [],
    } as unknown as ReturnType<typeof useJobModule.useJob>);

    render(<ProgressHeader />);

    // There can be multiple "Paused" labels (status + aria-live message)
    expect(screen.getAllByText(/Paused/i).length).toBeGreaterThan(0);
    const resumeBtn = screen.getByRole('button', { name: /resume/i });
    expect(resumeBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();

    await userEvent.click(resumeBtn);
    expect(dispatch).toHaveBeenCalledWith('RESUME_JOB');
  });

  it('shows error banner when snapshot.error is present', () => {
    vi.spyOn(useJobModule, 'useJob').mockReturnValue({
      snapshot: {
        jobId: 'j3',
        status: 'failed',
        stage: 'verifying',
        stageIndex: 4,
        stageUnits: { processed: 1, total: 1 },
        weightedPercent: 90,
        indeterminate: false,
        activity: 'Failed',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: null,
        error: 'No paused job to resume',
      },
      isConnected: true,
      error: null,
      dispatch: vi.fn(),
      refreshStatus: vi.fn(),
      isRunning: false,
      isPaused: false,
      isActive: false,
      isComplete: false,
      isFailed: true,
      isCancelled: false,
      progress: 90,
      currentStage: 'verifying',
      currentActivity: 'Failed',
      activity: [],
    } as unknown as ReturnType<typeof useJobModule.useJob>);

    render(<ProgressHeader />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Error:/i);
    expect(alert).toHaveTextContent(/No paused job to resume/i);
  });
});