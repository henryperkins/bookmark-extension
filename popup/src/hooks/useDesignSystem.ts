import React, { useMemo } from 'react';
import { designTokens, utils, createStyleUtils, DesignTokens } from '../styles/designSystem';

/**
 * Hook for accessing design system tokens and utilities
 * Provides memoized styles and theme consistency
 */
export function useDesignSystem(customTokens?: Partial<DesignTokens>) {
  const mergedTokens = useMemo(() => {
    if (!customTokens) return designTokens;

    // Deep merge custom tokens with default tokens
    return {
      ...designTokens,
      ...customTokens,
      typography: { ...designTokens.typography, ...customTokens.typography },
      spacing: { ...designTokens.spacing, ...customTokens.spacing },
      colors: { ...designTokens.colors, ...customTokens.colors },
      borderRadius: { ...designTokens.borderRadius, ...customTokens.borderRadius },
      shadows: { ...designTokens.shadows, ...customTokens.shadows },
      transitions: { ...designTokens.transitions, ...customTokens.transitions },
    };
  }, [customTokens]);

  const styleUtils = useMemo(() => {
    return createStyleUtils(mergedTokens);
  }, [mergedTokens]);

  // Memoized CSS custom properties
  const cssCustomProperties = useMemo(() => {
    const props: Record<string, string> = {};

    Object.entries(mergedTokens.typography).forEach(([key, value]) => {
      props[`--typography-${key}`] = value;
    });

    Object.entries(mergedTokens.spacing).forEach(([key, value]) => {
      props[`--spacing-${key}`] = value;
    });

    Object.entries(mergedTokens.colors).forEach(([key, value]) => {
      props[`--color-${key}`] = value;
    });

    Object.entries(mergedTokens.borderRadius).forEach(([key, value]) => {
      props[`--border-radius-${key}`] = value;
    });

    Object.entries(mergedTokens.shadows).forEach(([key, value]) => {
      props[`--shadow-${key}`] = value;
    });

    Object.entries(mergedTokens.transitions).forEach(([key, value]) => {
      props[`--transition-${key}`] = value;
    });

    return props;
  }, [mergedTokens]);

  return {
    tokens: mergedTokens,
    utils: styleUtils,
    cssCustomProperties,
  };
}

/**
 * Hook for responsive design utilities
 */
export function useResponsive() {
  const isClient = typeof window !== 'undefined';

  const getBreakpoint = () => {
    if (!isClient) return 'desktop';

    const width = window.innerWidth;
    if (width < 480) return 'mobile';
    if (width < 768) return 'tablet';
    if (width < 1024) return 'desktop';
    return 'wide';
  };

  const [breakpoint, setBreakpoint] = React.useState(getBreakpoint());

  React.useEffect(() => {
    if (!isClient) return;

    const handleResize = () => {
      setBreakpoint(getBreakpoint());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isClient]);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isWide: breakpoint === 'wide',
  };
}

/**
 * Hook for theme management (future enhancement for dark mode)
 */
export function useTheme() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('bookmark-extension-theme', newTheme);
    }
  };

  React.useEffect(() => {
    // Load theme from localStorage
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('bookmark-extension-theme') as 'light' | 'dark' | null;
      if (savedTheme && savedTheme !== theme) {
        setTheme(savedTheme);
      }
    }
  }, []);

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };
}

