import enStrings from './en.json';
import esStrings from './es.json';

export type Language = 'en' | 'es';

export interface TranslationKeys {
  tabs: {
    review: string;
    add: string;
    manage: string;
    importExport: string;
    progress: string;
  };
  tabDescriptions: {
    review: string;
    add: string;
    manage: string;
    importExport: string;
    progress: string;
  };
  reviewQueue: {
    title: string;
    loading: string;
    noDuplicates: string;
    filterPlaceholder: string;
    acceptAll: string;
    accept: string;
    reject: string;
    confirmAcceptAll: string;
    similarText: string;
  };
  addBookmark: {
    title: string;
    titleLabel: string;
    titlePlaceholder: string;
    urlLabel: string;
    urlPlaceholder: string;
    parentFolderLabel: string;
    parentFolderPlaceholder: string;
    submitButton: string;
    validationError: string;
    successMessage: string;
    errorMessage: string;
    duplicateWarning: string;
  };
  manageBookmarks: {
    title: string;
    loading: string;
    delete: string;
    confirmDelete: string;
    newTitlePrompt: string;
    untitled: string;
  };
  importExport: {
    title: string;
    exportTitle: string;
    exportButton: string;
    exportDescription: string;
    importTitle: string;
    importButton: string;
    importDescription: string;
    selectFileError: string;
    exportStarted: string;
    importComplete: string;
    parentFolderLabel: string;
    parentFolderPlaceholder: string;
  };
  jobProgress: {
    activeJobs: string;
    jobHistory: string;
    noActiveJobs: string;
    cancelJob: string;
    retryJob: string;
    viewDetails: string;
    pauseJob: string;
    resumeJob: string;
  };
  accessibility: {
    mainNavigation: string;
    progressIndicator: string;
    loadingState: string;
    buttonFocus: string;
  };
}

const translations: Record<Language, TranslationKeys> = {
  en: enStrings as TranslationKeys,
  es: esStrings as TranslationKeys,
};

// Get browser language or default to English
function getBrowserLanguage(): Language {
  const lang = navigator.language.split('-')[0] as Language;
  return translations[lang] ? lang : 'en';
}

export const currentLanguage = getBrowserLanguage();

// Sanitize input to prevent XSS and injection attacks
function sanitizeInput(input: string | number): string {
  if (typeof input === 'number') {
    return input.toString();
  }

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove potentially dangerous attributes
    .replace(/on\w+\s*=/g, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol (potential XSS vector)
    .replace(/data:(?!image\/)/gi, '')
    // Escape special characters that could break HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// Safe interpolation function for template strings with variables
function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      return match; // Keep placeholder if variable not found
    }
    return sanitizeInput(value);
  });
}

// Validate translation key format
function isValidTranslationKey(key: string): boolean {
  return /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/.test(key);
}

// Validate variables object
function validateVariables(variables: Record<string, any>): boolean {
  if (!variables || typeof variables !== 'object') {
    return false;
  }

  for (const [key, value] of Object.entries(variables)) {
    // Check key format
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
      return false;
    }

    // Check value type
    if (typeof value !== 'string' && typeof value !== 'number') {
      return false;
    }

    // Check for suspicious content
    if (typeof value === 'string') {
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /data:(?!image\/)/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return false;
        }
      }
    }
  }

  return true;
}

// Translation function with optional variable interpolation
export function t(
  key: string,
  variables?: Record<string, string | number>
): string {
  // Validate translation key
  if (!isValidTranslationKey(key)) {
    console.warn(`Invalid translation key format: ${key}`);
    return key;
  }

  // Validate variables if provided
  if (variables && !validateVariables(variables)) {
    console.warn(`Invalid variables provided for translation key: ${key}`, variables);
    return key;
  }

  const keys = key.split('.');
  let value: any = translations[currentLanguage];

  for (const k of keys) {
    value = value?.[k];
  }

  if (typeof value === 'string' && variables) {
    return interpolate(value, variables);
  }

  return typeof value === 'string' ? value : key;
}

// Hook for using translations in React components
export function useI18n() {
  return {
    t,
    language: currentLanguage,
    isRTL: false, // Add RTL support if needed in the future
  };
}