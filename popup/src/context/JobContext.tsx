import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { connectPort, getLocalStorage, sendRuntimeMessage, sendRuntimeMessageWithCallback } from '../utils/chrome';

// Import types from shared
type JobSnapshot = {
  jobId: string;
  status: 'idle' | 'queued' | 'running' | 'paused' | 'cancelling' | 'cancelled' | 'failed' | 'completed';
  stage: string;
  stageIndex: number;
  stageUnits: { processed: number; total?: number | null };
  weightedPercent: number;
  indeterminate: boolean;
  activity: string;
  timestamp: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  summary?: any;
  error?: string;
  queueMeta?: any;
  stageOrder?: string[];
  stageWeights?: Record<string, number>;
};

type JobActivity = {
  jobId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  stage?: string;
  context?: Record<string, unknown>;
};

type JobCommand = 'START_JOB' | 'PAUSE_JOB' | 'RESUME_JOB' | 'CANCEL_JOB' | 'GET_JOB_STATUS' | 'GET_ACTIVITY_LOG';

interface JobUIState {
  snapshot: JobSnapshot | null;
  activity: JobActivity[];
  isConnected: boolean;
  error: string | null;
}

interface JobContextValue extends JobUIState {
  dispatch: (command: JobCommand, payload?: any) => void;
  refreshStatus: () => void;
}

const JobContext = createContext<JobContextValue | null>(null);

interface JobProviderProps {
  children: ReactNode;
}

export function JobProvider({ children }: JobProviderProps) {
  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const [activity, setActivity] = useState<JobActivity[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isShuttingDownRef = useRef(false);
  const debugRef = useRef(false);

  // Lightweight debug logger gate
  const logDebug = (...args: any[]) => {
    if (debugRef.current) {
      try { console.log(...args); } catch {}
    }
  };

  // Load debug flag once
  useEffect(() => {
    const localStorage = getLocalStorage();
    if (!localStorage?.get) {
      return;
    }

    try {
      localStorage.get('debugLogs', (res) => {
        debugRef.current = !!(res && (res.debugLogs ?? (res as any)['debugLogs']));
      });
    } catch (error) {
      console.warn('[JobContext] Failed to load debug flag:', error);
    }
  }, []);

  /**
   * Connect to background job bus via port
   */
  const connect = useCallback(() => {
    try {
      logDebug('[JobContext] Connecting to job bus...');

      // Reset shutdown flag - we're actively connecting
      isShuttingDownRef.current = false;

      // Clean up existing port
      if (portRef.current) {
        try {
          portRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        portRef.current = null;
      }

      const port = connectPort('job-feed');
      if (!port) {
        console.warn('[JobContext] Unable to open runtime port');
        setIsConnected(false);
        setError('Failed to connect to background runtime');
        return;
      }
      portRef.current = port;
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;

      // Listen for messages from background
      port.onMessage.addListener((message) => {
        try {
          logDebug('[JobContext] Received message:', message);

          switch (message.type) {
            case 'jobStatus':
              if (message.job) {
                setSnapshot(message.job);
              }
              break;

            case 'jobActivity':
              if (message.activity) {
                setActivity((prev) => {
                  const newActivity = [...prev, message.activity];
                  // Keep only last 100 entries
                  return newActivity.slice(-100);
                });
              }
              break;

            case 'stageProgress':
              // Update snapshot with progress
              if (message.job) {
                setSnapshot(message.job);
              }
              break;

            case 'jobCompleted':
            case 'jobTerminated':
              // Handle terminal job events (completed, cancelled, failed)
              if (message.job) {
                setSnapshot(message.job);
                logDebug(`[JobContext] Job ${message.type}:`, message.job.status);
              }
              break;

            case 'jobConnected':
              console.log('[JobContext] Connected to job bus:', message.portName);
              break;

            case 'pong':
              // Heartbeat response, connection is alive
              break;

            case 'commandError':
              // Command failed (e.g., tried to resume when no paused job)
              console.error('[JobContext] Command error:', message.command, message.error);
              setError(message.error || 'Command failed');
              // Clear error after 5 seconds
              setTimeout(() => setError(null), 5000);
              break;

            case 'error':
              // General error from background
              console.error('[JobContext] Background error:', message.error);
              setError(message.error || 'An error occurred');
              setTimeout(() => setError(null), 5000);
              break;

            default:
              console.log('[JobContext] Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('[JobContext] Error processing message:', err);
        }
      });

      // Handle port disconnection
      port.onDisconnect.addListener(() => {
        logDebug('[JobContext] Port disconnected');
        portRef.current = null;
        setIsConnected(false);

        // Skip reconnection if we're intentionally shutting down
        if (isShuttingDownRef.current) {
          logDebug('[JobContext] Skipping reconnect - intentional shutdown');
          return;
        }

        // Attempt to reconnect with exponential backoff
        const maxAttempts = 5;
        if (reconnectAttemptsRef.current < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          logDebug(`[JobContext] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxAttempts})`);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          setError('Lost connection to background. Please close and reopen the popup.');
        }
      });

      const safePost = (message: Record<string, unknown>) => {
        try {
          port.postMessage(message);
        } catch (err) {
          console.error('[JobContext] Failed to post message on port:', err);
        }
      };

      safePost({
        type: 'jobCommand',
        command: 'GET_JOB_STATUS',
        timestamp: Date.now()
      });

      safePost({
        type: 'jobCommand',
        command: 'GET_ACTIVITY_LOG',
        payload: { limit: 50 },
        timestamp: Date.now()
      });

    } catch (err) {
      console.error('[JobContext] Failed to connect:', err);
      setIsConnected(false);
      setError('Failed to connect to background');
    }
  }, []);

  /**
   * Disconnect from job bus
   */
  const disconnect = useCallback(() => {
    console.log('[JobContext] Disconnecting...');

    // Set shutdown flag BEFORE disconnecting to prevent reconnection
    isShuttingDownRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (portRef.current) {
      try {
        portRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      portRef.current = null;
    }

    setIsConnected(false);
  }, []);

  /**
   * Dispatch a job command
   */
  const dispatch = useCallback((command: JobCommand, payload?: any) => {
    logDebug('[JobContext] Dispatching command:', command, payload);

    if (!portRef.current) {
      console.warn('[JobContext] Port not connected, using runtime fallback');
      const result = sendRuntimeMessage({
        type: 'jobCommand',
        command,
        payload
      });

      if (result) {
        result.catch((err) => {
          console.error('[JobContext] Failed to send message:', err);
        });
      }
      return;
    }

    try {
      portRef.current.postMessage({
        type: 'jobCommand',
        command,
        payload,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[JobContext] Failed to dispatch command:', err);
    }
  }, []);

  /**
   * Refresh job status (force update)
   */
  const refreshStatus = useCallback(() => {
    dispatch('GET_JOB_STATUS');
  }, [dispatch]);

  /**
   * Connect on mount, disconnect on unmount
   */
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  /**
   * Fallback polling if port connection fails
   */
  useEffect(() => {
    if (!isConnected && !error) {
      const pollInterval = setInterval(() => {
        logDebug('[JobContext] Polling for status (fallback mode)...');
        sendRuntimeMessageWithCallback<{ jobId?: string; snapshot?: JobSnapshot } | null>(
          { type: 'GET_JOB_STATUS' },
          (response) => {
            try {
              if (response && typeof response === 'object') {
                // Service worker may return either the snapshot object directly,
                // or an object with a { snapshot } property.
                if ((response as any).jobId) {
                  setSnapshot(response as JobSnapshot);
                } else if ((response as any).snapshot) {
                  setSnapshot((response as any).snapshot as JobSnapshot);
                }
              }
            } catch (e) {
              console.error('[JobContext] Fallback polling parse error:', e);
            }
          }
        );
      }, 5000);

      return () => clearInterval(pollInterval);
    }
  }, [isConnected, error]);

  const value: JobContextValue = {
    snapshot,
    activity,
    isConnected,
    error,
    dispatch,
    refreshStatus
  };

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

/**
 * Hook to access job context
 */
export function useJobContext(): JobContextValue {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobContext must be used within a JobProvider');
  }
  return context;
}
