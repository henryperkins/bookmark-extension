import { useEffect, useState } from 'react';

export interface AccessibilityPreferences {
  prefersReducedMotion: boolean;
  prefersHighContrast: boolean;
  screenReaderEnabled: boolean;
}

export function useAccessibility() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    prefersReducedMotion: false,
    prefersHighContrast: false,
    screenReaderEnabled: false,
  });

  useEffect(() => {
    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');

    // Initial checks
    setPreferences({
      prefersReducedMotion: motionQuery.matches,
      prefersHighContrast: contrastQuery.matches,
      screenReaderEnabled: detectScreenReader(),
    });

    // Listen for changes
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, prefersReducedMotion: e.matches }));
    };

    const handleContrastChange = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, prefersHighContrast: e.matches }));
    };

    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);

  return {
    ...preferences,
    // Helper function for conditional animations
    animationClass: (baseClass: string) =>
      preferences.prefersReducedMotion ? `${baseClass}--reduced-motion` : baseClass,

    // Helper for ARIA live regions
    announceToScreenReader: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', priority);
      announcement.setAttribute('aria-atomic', 'true');
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      announcement.textContent = message;

      document.body.appendChild(announcement);

      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    },
  };
}

// Basic screen reader detection
function detectScreenReader(): boolean {
  // Check for common screen reader indicators
  if (typeof window !== 'undefined') {
    // Check for screen reader browser extensions
    const hasScreenReaderExtension =
      window.speechSynthesis?.getVoices().length > 0 ||
      navigator.userAgent.includes('NVDA') ||
      navigator.userAgent.includes('JAWS') ||
      navigator.userAgent.includes('VoiceOver');

    // Check for reduced motion (often correlated with screen reader usage)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return hasScreenReaderExtension || prefersReducedMotion;
  }

  return false;
}

// CSS custom properties for accessibility
export function applyAccessibilityStyles(preferences: AccessibilityPreferences) {
  const root = document.documentElement;

  if (preferences.prefersReducedMotion) {
    root.style.setProperty('--transition-duration', '0.01ms');
    root.style.setProperty('--animation-duration', '0.01ms');
  }

  if (preferences.prefersHighContrast) {
    root.style.setProperty('--text-contrast', '1');
    root.style.setProperty('--border-contrast', '1');
  }
}