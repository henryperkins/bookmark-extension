import { useState, useEffect } from 'react';
import { JobProvider } from './context/JobContext';
import { ProgressHeader } from './components/ProgressHeader';
import { JobDashboard, CompactJobDashboard } from './components/JobDashboard';
import { StageList, ActivityFeed, MetricsPanel } from './components/Phase2Panels';
import { JobHistory } from './components/JobHistory';
import { useI18n } from './i18n';
import { useAccessibility } from './hooks/useAccessibility';

// Windows 11 2025 Typography Standards - Design System
const styles = {
  // Typography - Windows 11 Type Ramp
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
  },

  // Spacing (8px grid system)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
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
    border: '#c7c7c7',
    borderLight: '#e0e0e0',
    background: '#f9f9f9',
    backgroundAlt: '#f5f5f5',
    white: '#ffffff',
  },
} as const;

// Types
interface Duplicate {
  id: string;
  url: string;
  title: string;
  tags?: string[];
  similarity: number;
  duplicateOf?: {
    id: string;
    title: string;
    url: string;
  };
}

interface BookmarkNode {
  id: string;
  title?: string;
  url?: string;
  children?: BookmarkNode[];
}

// JobSnapshot type is now managed by JobContext

// Review Queue Component
function ReviewQueue() {
  const { t } = useI18n();
  const [pending, setPending] = useState<Duplicate[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: "GET_PENDING" }, (data) => {
      setPending(data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const accept = (id: string) => {
    chrome.runtime.sendMessage({ type: "ACCEPT_MERGE", id }, refresh);
  };

  const reject = (id: string) => {
    chrome.runtime.sendMessage({ type: "REJECT_MERGE", id }, refresh);
  };

  const acceptAll = () => {
    if (confirm(t('reviewQueue.confirmAcceptAll', { count: pending.length }))) {
      chrome.runtime.sendMessage({ type: "ACCEPT_ALL" }, refresh);
    }
  };

  const list = pending.filter(p =>
    (p.title || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ padding: styles.spacing.lg }}>
      <h3 style={{
        fontSize: styles.typography.fontSubtitle,
        lineHeight: styles.typography.lineSubtitle,
        fontWeight: styles.typography.weightSemibold,
        color: styles.colors.text,
        margin: 0,
        marginBottom: styles.spacing.lg
      }}>
        {t('reviewQueue.title')} ({pending.length})
      </h3>

      {pending.length > 0 && (
        <>
          <input
            type="text"
            placeholder={t('reviewQueue.filterPlaceholder')}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              width: '100%',
              padding: `${styles.spacing.sm} ${styles.spacing.md}`,
              marginBottom: styles.spacing.md,
              border: `1px solid ${styles.colors.borderLight}`,
              borderRadius: '4px',
              fontSize: styles.typography.fontBody,
              lineHeight: styles.typography.lineBody
            }}
          />

          <button
            onClick={acceptAll}
            style={{
              background: styles.colors.danger,
              color: styles.colors.white,
              border: 'none',
              padding: `${styles.spacing.sm} ${styles.spacing.lg}`,
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: styles.spacing.md,
              fontSize: styles.typography.fontBody,
              fontWeight: styles.typography.weightSemibold,
              lineHeight: styles.typography.lineBody
            }}
          >
            {t('reviewQueue.acceptAll')}
          </button>
        </>
      )}

      {loading && <p style={{ lineHeight: styles.typography.lineBody }}>{t('reviewQueue.loading')}</p>}

      {!loading && pending.length === 0 && (
        <p style={{
          color: styles.colors.textMuted,
          lineHeight: styles.typography.lineBody
        }}>
          {t('reviewQueue.noDuplicates')}
        </p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {list.map((d) => (
          <li
            key={d.id}
            style={{
              border: `1px solid ${styles.colors.borderLight}`,
              borderRadius: '4px',
              padding: styles.spacing.md,
              marginBottom: styles.spacing.sm,
              background: styles.colors.background,
              lineHeight: styles.typography.lineBody
            }}
          >
            <strong style={{
              fontWeight: styles.typography.weightSemibold,
              color: styles.colors.text
            }}>
              {d.title}
            </strong>
            <br />
            <small style={{
              color: styles.colors.textMuted,
              fontSize: styles.typography.fontCaption,
              lineHeight: styles.typography.lineBody
            }}>
              {d.url}
            </small>
            <br />
            <span style={{
              color: styles.colors.primary,
              fontSize: styles.typography.fontCaption
            }}>
              {t('reviewQueue.similarText', { percent: d.similarity, title: d.duplicateOf?.title })}
            </span>
            <div style={{ marginTop: styles.spacing.sm }}>
              <button
                onClick={() => accept(d.id)}
                style={{
                  background: styles.colors.success,
                  color: styles.colors.white,
                  border: 'none',
                  padding: `${styles.spacing.xs} ${styles.spacing.md}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: styles.spacing.sm,
                  fontSize: styles.typography.fontBody,
                  fontWeight: styles.typography.weightSemibold,
                  lineHeight: styles.typography.lineBody
                }}
              >
                {t('reviewQueue.accept')}
              </button>
              <button
                onClick={() => reject(d.id)}
                style={{
                  background: styles.colors.danger,
                  color: styles.colors.white,
                  border: 'none',
                  padding: `${styles.spacing.xs} ${styles.spacing.md}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: styles.typography.fontBody,
                  fontWeight: styles.typography.weightSemibold,
                  lineHeight: styles.typography.lineBody
                }}
              >
                {t('reviewQueue.reject')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Add Bookmark Component
function AddForm() {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [parentId, setParentId] = useState('1');

  const submit = () => {
    if (!title || !url) {
      alert(t('addBookmark.validationError'));
      return;
    }

    chrome.runtime.sendMessage({ type: "CHECK_DUPLICATE_URL", url }, (dup) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.warn('Duplicate lookup failed:', lastError.message);
      }
      if (dup?.exists) {
        const proceed = window.confirm(t('addBookmark.duplicateWarning'));
        if (!proceed) return;
      }

      chrome.runtime.sendMessage(
        { type: "CREATE_BOOKMARK", payload: { title, url, parentId } },
        (result) => {
          if (result?.id) {
            alert(t('addBookmark.successMessage'));
            setTitle('');
            setUrl('');
          } else {
            alert(t('addBookmark.errorMessage'));
          }
        }
      );
    });
  };

  return (
    <div style={{ padding: styles.spacing.lg }}>
      <h3 style={{
        fontSize: styles.typography.fontSubtitle,
        lineHeight: styles.typography.lineSubtitle,
        fontWeight: styles.typography.weightSemibold,
        color: styles.colors.text,
        margin: 0,
        marginBottom: styles.spacing.lg
      }}>
        {t('addBookmark.title')}
      </h3>

      <label style={{
        display: 'block',
        marginBottom: styles.spacing.md,
        fontWeight: styles.typography.weightSemibold,
        color: styles.colors.text,
        lineHeight: styles.typography.lineBody
      }}>
        {t('addBookmark.titleLabel')}
        <input
          type="text"
          placeholder={t('addBookmark.titlePlaceholder')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{
            width: '100%',
            padding: `${styles.spacing.sm} ${styles.spacing.md}`,
            marginTop: styles.spacing.xs,
            border: `1px solid ${styles.colors.borderLight}`,
            borderRadius: '4px',
            fontSize: styles.typography.fontBody,
            lineHeight: styles.typography.lineBody
          }}
        />
      </label>

      <label style={{
        display: 'block',
        marginBottom: styles.spacing.md,
        fontWeight: styles.typography.weightSemibold,
        color: styles.colors.text,
        lineHeight: styles.typography.lineBody
      }}>
        {t('addBookmark.urlLabel')}
        <input
          type="text"
          placeholder={t('addBookmark.urlPlaceholder')}
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={{
            width: '100%',
            padding: `${styles.spacing.sm} ${styles.spacing.md}`,
            marginTop: styles.spacing.xs,
            border: `1px solid ${styles.colors.borderLight}`,
            borderRadius: '4px',
            fontSize: styles.typography.fontBody,
            lineHeight: styles.typography.lineBody
          }}
        />
      </label>

      <label style={{
        display: 'block',
        marginBottom: styles.spacing.md,
        fontWeight: styles.typography.weightSemibold,
        color: styles.colors.text,
        lineHeight: styles.typography.lineBody
      }}>
        {t('addBookmark.parentFolderLabel')}
        <input
          type="text"
          placeholder={t('addBookmark.parentFolderPlaceholder')}
          value={parentId}
          onChange={e => setParentId(e.target.value)}
          style={{
            width: '100%',
            padding: `${styles.spacing.sm} ${styles.spacing.md}`,
            marginTop: styles.spacing.xs,
            border: `1px solid ${styles.colors.borderLight}`,
            borderRadius: '4px',
            fontSize: styles.typography.fontBody,
            lineHeight: styles.typography.lineBody
          }}
        />
      </label>

      <button
        onClick={submit}
        style={{
          background: styles.colors.primary,
          color: styles.colors.white,
          border: 'none',
          padding: `${styles.spacing.sm} ${styles.spacing.lg}`,
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: styles.typography.fontBody,
          fontWeight: styles.typography.weightSemibold,
          lineHeight: styles.typography.lineBody
        }}
      >
        {t('addBookmark.submitButton')}
      </button>
    </div>
  );
}

// Tree View Component
function TreeView() {
  const { t } = useI18n();
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: "GET_TREE" }, (data) => {
      setTree(data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const edit = (node: BookmarkNode) => {
    const title = prompt(t('manageBookmarks.newTitlePrompt'), node.title) || node.title;
    if (title) {
      chrome.runtime.sendMessage(
        { type: "UPDATE_BOOKMARK", id: node.id, changes: { title } },
        refresh
      );
    }
  };

  const del = (node: BookmarkNode) => {
    if (confirm(t('manageBookmarks.confirmDelete', { title: node.title || node.url }))) {
      chrome.runtime.sendMessage({ type: "DELETE_BOOKMARK", id: node.id }, refresh);
    }
  };

  const renderNode = (n: BookmarkNode) => (
    <li key={n.id} style={{
      marginBottom: styles.spacing.xs,
      lineHeight: styles.typography.lineBody
    }}>
      <span
        onClick={() => edit(n)}
        style={{
          cursor: 'pointer',
          color: styles.colors.primary,
          fontSize: styles.typography.fontBody
        }}
      >
        {n.url ? '📄 ' : '📁 '}
        {n.title || n.url || t('manageBookmarks.untitled')}
      </span>
      <button
        onClick={() => del(n)}
        style={{
          marginLeft: styles.spacing.sm,
          background: styles.colors.danger,
          color: styles.colors.white,
          border: 'none',
          padding: `2px ${styles.spacing.sm}`,
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: styles.typography.fontCaption,
          fontWeight: styles.typography.weightSemibold
        }}
      >
        {t('manageBookmarks.delete')}
      </button>
      {n.children && n.children.length > 0 && (
        <ul style={{ marginLeft: '1.25rem' }}>
          {n.children.map(renderNode)}
        </ul>
      )}
    </li>
  );

  return (
    <div style={{ padding: styles.spacing.lg }}>
      <h3 style={{
        fontSize: styles.typography.fontSubtitle,
        lineHeight: styles.typography.lineSubtitle,
        fontWeight: styles.typography.weightSemibold,
        color: styles.colors.text,
        margin: 0,
        marginBottom: styles.spacing.lg
      }}>
        {t('manageBookmarks.title')}
      </h3>

      {loading && <p style={{ lineHeight: styles.typography.lineBody }}>{t('manageBookmarks.loading')}</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {tree.map(renderNode)}
      </ul>
    </div>
  );
}

// Import/Export Component
function ImportExport() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [parentId, setParentId] = useState('1');

  const exportAll = () => {
    chrome.runtime.sendMessage({ type: "EXPORT_BOOKMARKS" }, () => {
      alert(t('importExport.exportStarted'));
    });
  };

  const importAll = async () => {
    if (!file) {
      alert(t('importExport.selectFileError'));
      return;
    }

    const text = await file.text();
    chrome.runtime.sendMessage(
      { type: "IMPORT_BOOKMARKS", text, parentId },
      () => {
        alert(t('importExport.importComplete'));
        setFile(null);
      }
    );
  };

  return (
    <div style={{ padding: styles.spacing.lg }}>
      <h3 style={{
        fontSize: styles.typography.fontSubtitle,
        lineHeight: styles.typography.lineSubtitle,
        fontWeight: styles.typography.weightSemibold,
        color: styles.colors.text,
        margin: 0,
        marginBottom: styles.spacing.lg
      }}>
        {t('importExport.title')}
      </h3>

      <div style={{ marginBottom: styles.spacing.xl }}>
        <h4 style={{
          fontSize: styles.typography.fontBodyLarge,
          lineHeight: styles.typography.lineSubtitle,
          fontWeight: styles.typography.weightSemibold,
          color: styles.colors.text,
          marginTop: 0,
          marginBottom: styles.spacing.md
        }}>
          {t('importExport.exportTitle')}
        </h4>
        <button
          onClick={exportAll}
          style={{
            background: styles.colors.primary,
            color: styles.colors.white,
            border: 'none',
            padding: `${styles.spacing.sm} ${styles.spacing.lg}`,
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: styles.typography.fontBody,
            fontWeight: styles.typography.weightSemibold,
            lineHeight: styles.typography.lineBody
          }}
        >
          {t('importExport.exportButton')}
        </button>
        <p style={{
          fontSize: styles.typography.fontCaption,
          color: styles.colors.textMuted,
          lineHeight: styles.typography.lineBody,
          marginTop: styles.spacing.sm
        }}>
          {t('importExport.exportDescription')}
        </p>
      </div>

      <div>
        <h4 style={{
          fontSize: styles.typography.fontBodyLarge,
          lineHeight: styles.typography.lineSubtitle,
          fontWeight: styles.typography.weightSemibold,
          color: styles.colors.text,
          marginTop: 0,
          marginBottom: styles.spacing.md
        }}>
          {t('importExport.importTitle')}
        </h4>
        <input
          type="file"
          accept=".html"
          onChange={e => setFile(e.target.files?.[0] || null)}
          style={{
            marginBottom: styles.spacing.sm,
            fontSize: styles.typography.fontBody
          }}
        />
        <br />
        <label style={{
          display: 'block',
          marginBottom: styles.spacing.sm,
          fontWeight: styles.typography.weightSemibold,
          color: styles.colors.text,
          lineHeight: styles.typography.lineBody
        }}>
          {t('importExport.parentFolderLabel')}
          <input
            type="text"
            placeholder={t('importExport.parentFolderPlaceholder')}
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            style={{
              width: '100px',
              padding: `${styles.spacing.xs} ${styles.spacing.sm}`,
              marginLeft: styles.spacing.sm,
              border: `1px solid ${styles.colors.borderLight}`,
              borderRadius: '4px',
              fontSize: styles.typography.fontBody,
              lineHeight: styles.typography.lineBody
            }}
          />
        </label>
        <button
          onClick={importAll}
          disabled={!file}
          style={{
            background: file ? styles.colors.success : '#ccc',
            color: styles.colors.white,
            border: 'none',
            padding: `${styles.spacing.sm} ${styles.spacing.lg}`,
            borderRadius: '4px',
            cursor: file ? 'pointer' : 'not-allowed',
            fontSize: styles.typography.fontBody,
            fontWeight: styles.typography.weightSemibold,
            lineHeight: styles.typography.lineBody
          }}
        >
          {t('importExport.importButton')}
        </button>
        <p style={{
          fontSize: styles.typography.fontCaption,
          color: styles.colors.textMuted,
          lineHeight: styles.typography.lineBody,
          marginTop: styles.spacing.sm
        }}>
          {t('importExport.importDescription')}
        </p>
      </div>
    </div>
  );
}

// Main App Component (inner, wrapped by JobProvider)
function AppContent() {
  const { t } = useI18n();
  const { prefersReducedMotion, announceToScreenReader } = useAccessibility();
  const [tab, setTab] = useState<'review' | 'add' | 'manage' | 'io' | 'progress'>('review');

  return (
    <div>
      {/* ProgressHeader - Always visible for real-time job status */}
      <ProgressHeader />

      {/* Job Dashboard - New comprehensive dashboard replacing individual panels */}
      {tab === 'progress' && <JobDashboard />}

      {/* Navigation Tabs - Updated with new Progress tab */}
      <nav
        style={{
          display: 'flex',
          borderBottom: `1px solid ${styles.colors.borderLight}`,
          background: styles.colors.backgroundAlt
        }}
        role="tablist"
        aria-label={t('accessibility.mainNavigation')}
      >
        {[
          { key: 'review', label: t('tabs.review'), description: t('tabDescriptions.review') },
          { key: 'add', label: t('tabs.add'), description: t('tabDescriptions.add') },
          { key: 'manage', label: t('tabs.manage'), description: t('tabDescriptions.manage') },
          { key: 'io', label: t('tabs.importExport'), description: t('tabDescriptions.importExport') },
          { key: 'progress', label: t('tabs.progress'), description: t('tabDescriptions.progress') }
        ].map(({ key, label, description }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key as any);
              // Announce tab change to screen readers
              announceToScreenReader(`${t('accessibility.buttonFocus')} ${label}`, 'polite');
            }}
            style={{
              flex: 1,
              padding: styles.spacing.md,
              background: tab === key ? styles.colors.white : 'transparent',
              border: 'none',
              borderBottom: tab === key ? `2px solid ${styles.colors.primary}` : 'none',
              cursor: 'pointer',
              fontWeight: tab === key ? styles.typography.weightSemibold : styles.typography.weightRegular,
              fontSize: styles.typography.fontBody,
              lineHeight: styles.typography.lineBody,
              color: styles.colors.text,
              position: 'relative',
              transition: prefersReducedMotion ? 'none' : 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              if (tab !== key) {
                e.currentTarget.style.backgroundColor = styles.colors.background;
              }
            }}
            onMouseOut={(e) => {
              if (tab !== key) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`${key}-panel`}
            title={description}
          >
            {label}
            {tab === 'progress' && (
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: styles.colors.primary,
                  marginLeft: styles.spacing.xs,
                  animation: !prefersReducedMotion ? 'pulse 2s ease-in-out infinite' : 'none',
                }}
                aria-hidden="true"
                  title={t('accessibility.progressIndicator')}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id={`${tab}-panel`}
        aria-labelledby={`${tab}-tab`}
        style={{
          minHeight: '400px', // Ensure adequate content area
        }}
      >
        {tab === 'review' && <ReviewQueue />}
        {tab === 'add' && <AddForm />}
        {tab === 'manage' && <TreeView />}
        {tab === 'io' && <ImportExport />}
        {/* Progress tab content is handled by JobDashboard component */}
      </div>

      {/* Accessibility and animation styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Enhanced accessibility styles */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }

          [style*="animation"] {
            animation: none !important;
          }

          [style*="transition"] {
            transition: none !important;
          }
        }

        @media (prefers-contrast: high) {
          button {
            border: 2px solid currentColor !important;
          }

          button:focus-visible {
            outline: 3px solid #0078d4 !important;
            outline-offset: 2px !important;
          }

          input:focus-visible {
            outline: 3px solid #0078d4 !important;
            outline-offset: 2px !important;
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

        /* Enhanced focus styles */
        *:focus-visible {
          outline: 2px solid #0078d4 !important;
          outline-offset: 2px !important;
        }

        /* High contrast mode support */
        @media (forced-colors: active) {
          button {
            border: 2px solid ButtonText !important;
            forced-color-adjust: none !important;
          }

          button:focus-visible {
            outline: 3px solid Highlight !important;
          }
        }
      `}</style>
    </div>
  );
}

// Main App component with JobProvider wrapper
export default function App() {
  return (
    <>
      <style>{`
        /* Windows 11 & Extension Design Standards - Hover & Focus States */
        button {
          font-family: 'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        button:hover {
          filter: brightness(0.9);
        }

        button:active {
          filter: brightness(0.85);
        }

        button:focus-visible {
          outline: 2px solid #0078d4;
          outline-offset: 2px;
        }

        input:focus-visible {
          outline: 2px solid #0078d4;
          outline-offset: 2px;
        }

        /* Ensure minimum 14px Semibold legibility (Windows 11 standard) */
        body {
          font-family: 'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>
      <JobProvider>
        <AppContent />
      </JobProvider>
    </>
  );
}
