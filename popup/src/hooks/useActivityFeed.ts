import { useMemo, useState } from 'react';
import { useJob } from './useJob';

type Level = 'all' | 'info' | 'warn' | 'error';

export interface ActivityFilters {
  level: Level;
  stage: string | 'all';
  search: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  timeText: string;
  level: 'info' | 'warn' | 'error';
  stage?: string;
  message: string;
  context?: Record<string, unknown>;
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch {
    return ts;
  }
}

export function useActivityFeed() {
  const { activity } = useJob();
  const [filters, setFilters] = useState<ActivityFilters>({
    level: 'all',
    stage: 'all',
    search: ''
  });

  const items = useMemo<ActivityItem[]>(() => {
    const searchLower = filters.search.trim().toLowerCase();
    return (activity || [])
      .filter((a) => {
        if (filters.level !== 'all' && a.level !== filters.level) return false;
        if (filters.stage !== 'all' && a.stage !== filters.stage) return false;
        if (searchLower) {
          const text = `${a.message} ${a.stage ?? ''}`.toLowerCase();
          if (!text.includes(searchLower)) return false;
        }
        return true;
      })
      .map((a, idx) => ({
        id: `${a.timestamp}-${idx}`,
        timestamp: a.timestamp,
        timeText: formatTime(a.timestamp),
        level: a.level,
        stage: a.stage,
        message: a.message,
        context: a.context
      }))
      .slice(-100);
  }, [activity, filters]);

  const clear = () => setFilters({ level: 'all', stage: 'all', search: '' });

  return {
    items,
    isEmpty: items.length === 0,
    filters,
    setFilters,
    clear
  };
}