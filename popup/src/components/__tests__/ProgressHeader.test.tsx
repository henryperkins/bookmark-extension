import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ProgressHeader } from '../ProgressHeader';
import * as useJobModule from '../../hooks/useJob';
import * as useAccessibilityModule from '../../hooks/useAccessibility';
import * as useI18nModule from '../../i18n';
import * as useDesignSystemModule from '../../hooks/useDesignSystem';

afterEach(() => {
  vi.clearAllMocks();
});

describe('[ProgressHeader](popup/src/components/ProgressHeader.tsx:1)', () => {
  beforeEach(() => {
    // Mock accessibility hook
    vi.spyOn(useAccessibilityModule, 'useAccessibility').mockReturnValue({
      prefersReducedMotion: false,
      prefersHighContrast: false,
      screenReaderEnabled: false,
      announceToScreenReader: vi.fn(),
    });

    // Mock i18n hook
    vi.spyOn(useI18nModule, 'useI18n').mockReturnValue({
      t: vi.fn((key: string) => {
        const translations: Record<string, string> = {
          'jobProgress.errorPrefix': 'Error:',
          'jobProgress.status.running': 'Running',
          'jobProgress.status.paused': 'Paused',
          'jobProgress.status.completed': 'Completed',
          'jobProgress.status.failed': 'Failed',
          'jobProgress.stageLabel': 'Stage:',
          'jobProgress.stagePrefix': 'Stage:',
          'jobProgress.pause': 'Pause',
          'jobProgress.resume': 'Resume',
          'jobProgress.cancel': 'Cancel',
          'jobProgress.summaryTitle': 'Summary',
          'jobProgress.pauseJob': 'Pause',
          'jobProgress.resumeJob': 'Resume',
          'jobProgress.cancelJob': 'Cancel',
          'jobProgress.stages.resolving': 'Resolving',
          'jobProgress.stages.scanning': 'Scanning',
          'jobProgress.stages.verifying': 'Verifying',
        };
        return translations[key] || key;
      }),
      formatTime: vi.fn(),
      formatDate: vi.fn(),
    });

    // Mock design system hook
    vi.spyOn(useDesignSystemModule, 'useDesignSystem').mockReturnValue({
      tokens: {
        typography: {
          fontCaption: '12px',
          fontBody: '14px',
          fontBodyLarge: '18px',
          fontSubtitle: '20px',
          fontTitle: '28px',
          lineCaption: '16px',
          lineBody: '20px',
          lineBodyLarge: '24px',
          lineSubtitle: '28px',
          lineTitle: '36px',
          weightRegular: 400,
          weightSemibold: 600,
          fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '12px',
          lg: '16px',
          xl: '20px',
          xxl: '24px',
          xxxl: '32px',
        },
        colors: {
          text: '#1a1a1a',
          textSecondary: '#555',
          textMuted: '#666',
          primary: '#0078d4',
          primaryHover: '#005a9e',
          success: '#107c10',
          warning: '#ff8c00',
          error: '#d13438',
          danger: '#d13438',
          background: '#ffffff',
          backgroundSecondary: '#f5f5f5',
          border: '#e1e1e1',
          borderLight: '#e1e1e1',
          white: '#ffffff',
        },
        borderRadius: {
          sm: '2px',
          md: '4px',
          medium: '4px',
          lg: '8px',
        },
        shadows: {
          sm: '0 1px 3px rgba(0,0,0,0.12)',
          md: '0 4px 6px rgba(0,0,0,0.07)',
          lg: '0 10px 25px rgba(0,0,0,0.1)',
        },
        transitions: {
          fast: '150ms ease-in-out',
          normal: '250ms ease-in-out',
          slow: '350ms ease-in-out',
        },
      },
      utils: {
        flex: vi.fn(),
        button: {
          primary: vi.fn(() => ({
            backgroundColor: '#0078d4',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: '20px',
            cursor: 'pointer',
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
            transition: 'all 0.25s ease-in-out',
          })),
          secondary: vi.fn(() => ({
            backgroundColor: 'transparent',
            color: '#0078d4',
            border: '1px solid #e1e1e1',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: '20px',
            cursor: 'pointer',
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
            transition: 'all 0.25s ease-in-out',
          })),
          danger: vi.fn(() => ({
            backgroundColor: '#d13438',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: '20px',
            cursor: 'pointer',
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
            transition: 'all 0.25s ease-in-out',
          })),
        },
        input: {
          text: vi.fn(() => ({
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #e1e1e1',
            borderRadius: '4px',
            fontSize: '14px',
            lineHeight: '20px',
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
            transition: '0.15s ease-in-out',
            outline: 'none',
          })),
        },
        card: vi.fn(),
        typography: {
          caption: vi.fn(() => ({
            fontSize: '12px',
            lineHeight: '16px',
            fontWeight: 400,
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
          })),
          body: vi.fn(() => ({
            fontSize: '14px',
            lineHeight: '20px',
            fontWeight: 400,
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
          })),
          bodyLarge: vi.fn(() => ({
            fontSize: '18px',
            lineHeight: '24px',
            fontWeight: 400,
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
          })),
          subtitle: vi.fn(() => ({
            fontSize: '20px',
            lineHeight: '28px',
            fontWeight: 600,
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
          })),
          title: vi.fn(() => ({
            fontSize: '28px',
            lineHeight: '36px',
            fontWeight: 600,
            fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif",
          })),
        },
      },
      cssCustomProperties: {},
    });
  });

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