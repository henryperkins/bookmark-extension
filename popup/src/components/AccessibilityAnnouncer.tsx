import { useEffect, useRef, useCallback } from 'react';

interface AccessibilityAnnouncerProps {
  message: string;
  priority?: 'polite' | 'assertive';
  clearOnMessageChange?: boolean;
}

export function AccessibilityAnnouncer({
  message,
  priority = 'polite',
  clearOnMessageChange = true,
}: AccessibilityAnnouncerProps) {
  const announcementRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (announcementRef.current && message) {
      if (clearOnMessageChange) {
        announcementRef.current.textContent = '';
        // Small delay to ensure screen readers pick up the change
        timeoutRef.current = setTimeout(() => {
          if (announcementRef.current) {
            announcementRef.current.textContent = message;
          }
        }, 50);
      } else {
        announcementRef.current.textContent = message;
      }
    }
  }, [message, clearOnMessageChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  if (!message) {
    return null;
  }

  return (
    <div
      ref={announcementRef}
      aria-live={priority}
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      {message}
    </div>
  );
}

// Hook for programmatic announcements
export function useAnnouncer() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Sanitize message to prevent XSS
    const sanitizedMessage = message.replace(/<[^>]*>/g, '');

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = sanitizedMessage;

    document.body.appendChild(announcement);

    // Remove after announcement to prevent DOM buildup
    const cleanupTimeout = setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);

    // Return cleanup function for manual cleanup if needed
    return () => {
      clearTimeout(cleanupTimeout);
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    };
  }, []);

  return { announce };
}