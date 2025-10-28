import { useState, useEffect } from 'react';

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

interface JobSnapshot {
  jobId?: string;
  status?: string;
  stage?: string;
  stageIndex?: number;
  totalUnits?: number | null;
  processedUnits?: number;
  stagePercent?: number;
  weightedPercent?: number;
  indeterminate?: boolean;
  activity?: string;
  timestamp?: string;
  // Optional summary payload from completion
  summary?: any;
}

// Review Queue Component
function ReviewQueue() {
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
    if (confirm(`Accept all ${pending.length} duplicates for removal?`)) {
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
        Review Duplicates ({pending.length})
      </h3>

      {pending.length > 0 && (
        <>
          <input
            type="text"
            placeholder="Filter by title..."
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
            Accept All
          </button>
        </>
      )}

      {loading && <p style={{ lineHeight: styles.typography.lineBody }}>Loading...</p>}

      {!loading && pending.length === 0 && (
        <p style={{
          color: styles.colors.textMuted,
          lineHeight: styles.typography.lineBody
        }}>
          No duplicates pending review.
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
              {d.similarity}% similar to: {d.duplicateOf?.title}
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
                Accept
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
                Reject
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
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [parentId, setParentId] = useState('1');

  const submit = () => {
    if (!title || !url) {
      alert('Please enter both title and URL');
      return;
    }

    chrome.runtime.sendMessage(
      { type: "CREATE_BOOKMARK", payload: { title, url, parentId } },
      (result) => {
        if (result?.id) {
          alert('Bookmark added!');
          setTitle('');
          setUrl('');
        } else {
          alert('Failed to add bookmark');
        }
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
        Add Bookmark
      </h3>

      <label style={{
        display: 'block',
        marginBottom: styles.spacing.md,
        fontWeight: styles.typography.weightSemibold,
        color: styles.colors.text,
        lineHeight: styles.typography.lineBody
      }}>
        Title
        <input
          type="text"
          placeholder="Bookmark title"
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
        URL
        <input
          type="text"
          placeholder="https://example.com"
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
        Parent Folder ID
        <input
          type="text"
          placeholder="1"
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
        Add Bookmark
      </button>
    </div>
  );
}

// Tree View Component
function TreeView() {
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
    const title = prompt('New title:', node.title) || node.title;
    if (title) {
      chrome.runtime.sendMessage(
        { type: "UPDATE_BOOKMARK", id: node.id, changes: { title } },
        refresh
      );
    }
  };

  const del = (node: BookmarkNode) => {
    if (confirm(`Delete "${node.title || node.url}"?`)) {
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
        {n.title || n.url || 'Untitled'}
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
        Delete
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
        Manage Bookmarks
      </h3>

      {loading && <p style={{ lineHeight: styles.typography.lineBody }}>Loading...</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {tree.map(renderNode)}
      </ul>
    </div>
  );
}

// Import/Export Component
function ImportExport() {
  const [file, setFile] = useState<File | null>(null);
  const [parentId, setParentId] = useState('1');

  const exportAll = () => {
    chrome.runtime.sendMessage({ type: "EXPORT_BOOKMARKS" }, () => {
      alert('Export started! Check your downloads.');
    });
  };

  const importAll = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    const text = await file.text();
    chrome.runtime.sendMessage(
      { type: "IMPORT_BOOKMARKS", text, parentId },
      () => {
        alert('Import complete!');
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
        Import/Export
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
          Export
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
          Export All Bookmarks
        </button>
        <p style={{
          fontSize: styles.typography.fontCaption,
          color: styles.colors.textMuted,
          lineHeight: styles.typography.lineBody,
          marginTop: styles.spacing.sm
        }}>
          Exports bookmarks in Netscape HTML format
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
          Import
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
          Parent Folder ID
          <input
            type="text"
            placeholder="1"
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
          Import Bookmarks
        </button>
        <p style={{
          fontSize: styles.typography.fontCaption,
          color: styles.colors.textMuted,
          lineHeight: styles.typography.lineBody,
          marginTop: styles.spacing.sm
        }}>
          Imports from Netscape HTML format (standard browser export)
        </p>
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const [tab, setTab] = useState<'review' | 'add' | 'manage' | 'io'>('review');
  const [job, setJob] = useState<JobSnapshot | null>(null);

  // Poll lightweight job status from the service worker
  useEffect(() => {
    let timer: number | null = null;
    const poll = () => {
      try {
        chrome.runtime.sendMessage({ type: "GET_JOB_STATUS" }, (data) => {
          setJob(data || null);
        });
      } catch {
        // ignore
      }
    };
    poll(); // immediate
    timer = window.setInterval(poll, 1000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

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
      <div>
        {job && (
          <div
            style={{
              padding: styles.spacing.sm,
              background: styles.colors.backgroundAlt,
              borderBottom: `1px solid ${styles.colors.borderLight}`
            }}
            aria-live="polite"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: styles.spacing.xs }}>
              <span style={{ fontSize: styles.typography.fontBody, color: styles.colors.text }}>
                {(job.stage ? job.stage.charAt(0).toUpperCase() + job.stage.slice(1) : 'Working')}
                {job.activity ? ` — ${job.activity}` : ''}
              </span>
              <span style={{ fontSize: styles.typography.fontBody, color: styles.colors.text }}>
                {Math.round(100 * (job.weightedPercent ?? job.stagePercent ?? 0))}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(100 * (job.weightedPercent ?? job.stagePercent ?? 0))}
              aria-valuetext={job.indeterminate ? 'Working…' : `${Math.round(100 * (job.weightedPercent ?? job.stagePercent ?? 0))}%`}
            >
              <div
                style={{
                  height: '6px',
                  background: styles.colors.borderLight,
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${Math.round(100 * (job.weightedPercent ?? job.stagePercent ?? 0))}%`,
                    height: '100%',
                    background: styles.colors.primary,
                    transition: 'width 200ms ease'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      <nav
        style={{
          display: 'flex',
          borderBottom: `1px solid ${styles.colors.borderLight}`,
          background: styles.colors.backgroundAlt
        }}
      >
        {[
          { key: 'review', label: 'Review' },
          { key: 'add', label: 'Add' },
          { key: 'manage', label: 'Manage' },
          { key: 'io', label: 'Import/Export' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
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
              color: styles.colors.text
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'review' && <ReviewQueue />}
      {tab === 'add' && <AddForm />}
      {tab === 'manage' && <TreeView />}
      {tab === 'io' && <ImportExport />}
      </div>
    </>
  );
}
