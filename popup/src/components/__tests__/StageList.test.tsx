import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StageList } from '../Phase2Panels';
import * as useJobModule from '../../hooks/useJob';

afterEach(() => {
  vi.clearAllMocks();
});

describe('[StageList](popup/src/components/Phase2Panels.tsx:1)', () => {
  it('renders all stages and shows active stage progress (processed/total)', () => {
    const snapshot = {
      jobId: 'job-1',
      status: 'running',
      stage: 'resolving',
      stageIndex: 3,
      stageUnits: { processed: 50, total: 100 },
      weightedPercent: 42,
      indeterminate: false,
      activity: 'Resolving duplicates…',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      // Provide explicit order to ensure deterministic labels
      stageOrder: ['initializing', 'scanning', 'grouping', 'resolving', 'verifying', 'summarizing'],
    };

    vi.spyOn(useJobModule, 'useJob').mockReturnValue({
      snapshot,
      isConnected: true,
      error: null,
      dispatch: vi.fn(),
      refreshStatus: vi.fn(),
      // Helpers (not used directly here)
      isRunning: true,
      isPaused: false,
      isActive: true,
      isComplete: false,
      isFailed: false,
      isCancelled: false,
      progress: snapshot.weightedPercent,
      currentStage: snapshot.stage,
      currentActivity: snapshot.activity,
      activity: [],
    } as unknown as ReturnType<typeof useJobModule.useJob>);

    render(<StageList />);

    // Section heading
    expect(screen.getByRole('heading', { name: /Stages/i })).toBeInTheDocument();

    // Known labels from map
    expect(screen.getByText('Initializing')).toBeInTheDocument();
    expect(screen.getByText('Scanning')).toBeInTheDocument();
    expect(screen.getByText('Grouping')).toBeInTheDocument();
    expect(screen.getByText('Resolving')).toBeInTheDocument();
    expect(screen.getByText('Verifying')).toBeInTheDocument();
    expect(screen.getByText('Summarizing')).toBeInTheDocument();

    // Active stage numeric progress appears as processed/total for the row footer
    expect(screen.getByText('50/100')).toBeInTheDocument();
  });

  it('renders indeterminate progress when total is not known', () => {
    const snapshot = {
      jobId: 'job-2',
      status: 'running',
      stage: 'scanning',
      stageIndex: 1,
      stageUnits: { processed: 10, total: null }, // total unknown
      weightedPercent: 10,
      indeterminate: true,
      activity: 'Scanning…',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      stageOrder: ['initializing', 'scanning', 'grouping', 'resolving', 'verifying', 'summarizing'],
    };

    vi.spyOn(useJobModule, 'useJob').mockReturnValue({
      snapshot,
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
      progress: snapshot.weightedPercent,
      currentStage: snapshot.stage,
      currentActivity: snapshot.activity,
      activity: [],
    } as unknown as ReturnType<typeof useJobModule.useJob>);

    render(<StageList />);

    // Labels exist
    expect(screen.getByText('Scanning')).toBeInTheDocument();

    // No numeric processed/total text when total is unknown
    expect(screen.queryByText(/\/\d+$/)).not.toBeInTheDocument();
  });

  it('renders nothing when there is no snapshot', () => {
    vi.spyOn(useJobModule, 'useJob').mockReturnValue({
      snapshot: null,
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
      activity: [],
    } as unknown as ReturnType<typeof useJobModule.useJob>);

    const { container } = render(<StageList />);
    // Should render null
    expect(container).toBeEmptyDOMElement();
  });
});