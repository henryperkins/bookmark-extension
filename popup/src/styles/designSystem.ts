/**
 * Shared Design System for Bookmark Extension
 * Windows 11 2025 Typography Standards
 * Reduces styling duplication across components
 */

export const designTokens = {
  // Typography - Windows 11 Type Ramp (8px grid system)
  typography: {
    // Font Sizes (Windows 11 Standards in epx)
    fontCaption: '12px',
    fontBody: '14px',
    fontBodyLarge: '18px',
    fontSubtitle: '20px',
    fontTitle: '28px',

    // Line Heights (Windows 11 Standards)
    lineCaption: '16px',
    lineBody: '20px',
    lineBodyLarge: '24px',
    lineSubtitle: '28px',
    lineTitle: '36px',

    // Font Weights (Windows 11: Regular for text, Semibold for titles)
    weightRegular: 400,
    weightSemibold: 600,

    // Font Family
    fontFamily: "'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  // Spacing (8px grid system)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
    xxxl: '32px',
  },

  // Colors (WCAG AA compliant - 4.5:1 contrast minimum)
  colors: {
    text: '#1a1a1a',
    textSecondary: '#555',
    textMuted: '#666',
    primary: '#0078d4',      // Microsoft Blue
    primaryHover: '#005a9e',
    success: '#107c10',      // Windows Green
    successHover: '#0e6b0e',
    danger: '#d13438',       // Windows Red
    dangerHover: '#a52a2d',
    warning: '#ff8c00',      // Warning Orange
    border: '#c7c7c7',
    borderLight: '#e0e0e0',
    background: '#f9f9f9',
    backgroundAlt: '#f5f5f5',
    white: '#ffffff',
  },

  // Border Radius
  borderRadius: {
    small: '3px',
    medium: '4px',
    large: '6px',
    xl: '8px',
  },

  // Shadows
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.1)',
    medium: '0 2px 8px rgba(0, 0, 0, 0.12)',
    large: '0 4px 16px rgba(0, 0, 0, 0.15)',
  },

  // Transitions
  transitions: {
    fast: '0.15s ease-in-out',
    normal: '0.2s ease-in-out',
    slow: '0.3s ease-in-out',
  },

  // Z-index scale
  zIndex: {
    base: 0,
    overlay: 100,
    modal: 200,
    tooltip: 300,
    notification: 400,
  },
} as const;

export type DesignTokens = typeof designTokens;

// CSS Custom Properties Generator
export function generateCSSCustomProperties(tokens: DesignTokens = designTokens) {
  const cssProps: Record<string, string> = {};

  // Typography
  Object.entries(tokens.typography).forEach(([key, value]) => {
    cssProps[`--typography-${key}`] = value;
  });

  // Spacing
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    cssProps[`--spacing-${key}`] = value;
  });

  // Colors
  Object.entries(tokens.colors).forEach(([key, value]) => {
    cssProps[`--color-${key}`] = value;
  });

  // Border Radius
  Object.entries(tokens.borderRadius).forEach(([key, value]) => {
    cssProps[`--border-radius-${key}`] = value;
  });

  // Shadows
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    cssProps[`--shadow-${key}`] = value;
  });

  // Transitions
  Object.entries(tokens.transitions).forEach(([key, value]) => {
    cssProps[`--transition-${key}`] = value;
  });

  return cssProps;
}

// Responsive breakpoints
export const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
} as const;

// Style utility functions
export const createStyleUtils = (tokens: DesignTokens = designTokens) => ({
  // Typography utilities
  typography: {
    caption: (additionalStyles = {}) => ({
      fontSize: tokens.typography.fontCaption,
      lineHeight: tokens.typography.lineCaption,
      fontWeight: tokens.typography.weightRegular,
      fontFamily: tokens.typography.fontFamily,
      ...additionalStyles,
    }),

    body: (additionalStyles = {}) => ({
      fontSize: tokens.typography.fontBody,
      lineHeight: tokens.typography.lineBody,
      fontWeight: tokens.typography.weightRegular,
      fontFamily: tokens.typography.fontFamily,
      ...additionalStyles,
    }),

    bodyLarge: (additionalStyles = {}) => ({
      fontSize: tokens.typography.fontBodyLarge,
      lineHeight: tokens.typography.lineBodyLarge,
      fontWeight: tokens.typography.weightRegular,
      fontFamily: tokens.typography.fontFamily,
      ...additionalStyles,
    }),

    subtitle: (additionalStyles = {}) => ({
      fontSize: tokens.typography.fontSubtitle,
      lineHeight: tokens.typography.lineSubtitle,
      fontWeight: tokens.typography.weightSemibold,
      fontFamily: tokens.typography.fontFamily,
      ...additionalStyles,
    }),

    title: (additionalStyles = {}) => ({
      fontSize: tokens.typography.fontTitle,
      lineHeight: tokens.typography.lineTitle,
      fontWeight: tokens.typography.weightSemibold,
      fontFamily: tokens.typography.fontFamily,
      ...additionalStyles,
    }),
  },

  // Spacing utilities
  spacing: {
    margin: (size: keyof typeof tokens.spacing, additionalStyles = {}) => ({
      margin: tokens.spacing[size],
      ...additionalStyles,
    }),

    padding: (size: keyof typeof tokens.spacing, additionalStyles = {}) => ({
      padding: tokens.spacing[size],
      ...additionalStyles,
    }),

    gap: (size: keyof typeof tokens.spacing, additionalStyles = {}) => ({
      gap: tokens.spacing[size],
      ...additionalStyles,
    }),
  },

  // Color utilities
  colors: {
    text: (variant: keyof typeof tokens.colors = 'text', additionalStyles = {}) => ({
      color: tokens.colors[variant],
      ...additionalStyles,
    }),

    background: (variant: keyof typeof tokens.colors = 'background', additionalStyles = {}) => ({
      backgroundColor: tokens.colors[variant],
      ...additionalStyles,
    }),

    border: (variant: keyof typeof tokens.colors = 'border', additionalStyles = {}) => ({
      borderColor: tokens.colors[variant],
      borderStyle: 'solid',
      borderWidth: '1px',
      ...additionalStyles,
    }),
  },

  // Component utilities
  button: {
    primary: (additionalStyles = {}) => ({
      backgroundColor: tokens.colors.primary,
      color: tokens.colors.white,
      border: 'none',
      padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
      borderRadius: tokens.borderRadius.medium,
      fontSize: tokens.typography.fontBody,
      fontWeight: tokens.typography.weightSemibold,
      lineHeight: tokens.typography.lineBody,
      cursor: 'pointer',
      fontFamily: tokens.typography.fontFamily,
      transition: `all ${tokens.transitions.normal}`,
      ...additionalStyles,
    }),

    secondary: (additionalStyles = {}) => ({
      backgroundColor: 'transparent',
      color: tokens.colors.primary,
      border: `1px solid ${tokens.colors.border}`,
      padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
      borderRadius: tokens.borderRadius.medium,
      fontSize: tokens.typography.fontBody,
      fontWeight: tokens.typography.weightSemibold,
      lineHeight: tokens.typography.lineBody,
      cursor: 'pointer',
      fontFamily: tokens.typography.fontFamily,
      transition: `all ${tokens.transitions.normal}`,
      ...additionalStyles,
    }),

    danger: (additionalStyles = {}) => ({
      backgroundColor: tokens.colors.danger,
      color: tokens.colors.white,
      border: 'none',
      padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
      borderRadius: tokens.borderRadius.medium,
      fontSize: tokens.typography.fontBody,
      fontWeight: tokens.typography.weightSemibold,
      lineHeight: tokens.typography.lineBody,
      cursor: 'pointer',
      fontFamily: tokens.typography.fontFamily,
      transition: `all ${tokens.transitions.normal}`,
      ...additionalStyles,
    }),
  },

  // Layout utilities
  layout: {
    card: (additionalStyles = {}) => ({
      backgroundColor: tokens.colors.white,
      border: `1px solid ${tokens.colors.borderLight}`,
      borderRadius: tokens.borderRadius.medium,
      padding: tokens.spacing.lg,
      boxShadow: tokens.shadows.small,
      ...additionalStyles,
    }),

    flex: {
      center: (additionalStyles = {}) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...additionalStyles,
      }),

      between: (additionalStyles = {}) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...additionalStyles,
      }),

      start: (additionalStyles = {}) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        ...additionalStyles,
      }),
    },
  },

  // Input utilities
  input: {
    text: (additionalStyles = {}) => ({
      width: '100%',
      padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
      border: `1px solid ${tokens.colors.borderLight}`,
      borderRadius: tokens.borderRadius.medium,
      fontSize: tokens.typography.fontBody,
      lineHeight: tokens.typography.lineBody,
      fontFamily: tokens.typography.fontFamily,
      transition: `all ${tokens.transitions.normal}`,
      outline: 'none',
      ...additionalStyles,
    }),
  },
});

// Export default utilities
export const utils = createStyleUtils(designTokens);

// Generate CSS for global styles
export const globalCSS = `
  :root {
    ${Object.entries(generateCSSCustomProperties(designTokens))
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n    ')}
  }

  /* Base styles */
  * {
    box-sizing: border-box;
  }

  body {
    font-family: ${designTokens.typography.fontFamily};
    color: ${designTokens.colors.text};
    background-color: ${designTokens.colors.background};
    margin: 0;
    padding: 0;
  }

  /* Focus styles */
  *:focus-visible {
    outline: 2px solid ${designTokens.colors.primary};
    outline-offset: 2px;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    :root {
      --text-contrast: 1;
      --border-contrast: 1;
    }
  }

  /* Forced colors mode */
  @media (forced-colors: active) {
    button {
      border: 2px solid ButtonText !important;
      forced-color-adjust: none !important;
    }

    button:focus-visible {
      outline: 3px solid Highlight !important;
    }
  }

  /* Screen reader only content */
  .sr-only {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }
`;

export default designTokens;