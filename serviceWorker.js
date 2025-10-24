import { createOpenAI } from "./openaiClient.js";
import { dedupeNodes } from "./embeddings.js";
import { tagNodes } from "./tagger.js";
import { writeTags } from "./writer.js";
import { addBookmark, editBookmark, deleteBookmark } from "./bookmarksCrud.js";
import { exportBookmarks } from "./exporter.js";
import { importHtml } from "./importer.js";
import { createRateLimiter } from "./utils/rateLimiter.js";
import { StorageManager } from "./utils/storageManager.js";
import { NotificationManager } from "./utils/notificationManager.js";
import { suggestFolders } from "./utils/folderOrganizer.js";
import { SyncManager } from "./utils/syncManager.js";
import { makePairKey, normalizeUrlForKey } from "./utils/url.js";

let reviewQueue = [];
let ignorePairsCache = null;
let cleanupTask = null;
let importInProgress = false;
const storageManager = new StorageManager();

const IGNORE_STORAGE_KEY = "ignoredDuplicates";

async function loadQueue() {
  const { reviewQueue: stored } = await chrome.storage.local.get('reviewQueue');
  reviewQueue = stored || [];
}

async function saveQueue() {
  await chrome.storage.local.set({ reviewQueue });
}

async function loadIgnorePairs(force = false) {
  if (!ignorePairsCache || force) {
    const { [IGNORE_STORAGE_KEY]: stored } = await chrome.storage.local.get(IGNORE_STORAGE_KEY);
    const list = Array.isArray(stored) ? stored : [];
    ignorePairsCache = new Set(list);
  }
  return ignorePairsCache;
}

async function persistIgnorePairs() {
  if (!ignorePairsCache) return;
  await chrome.storage.local.set({ [IGNORE_STORAGE_KEY]: Array.from(ignorePairsCache) });
}

async function addIgnoredPair(urlA, urlB) {
  const key = makePairKey(urlA, urlB);
  if (!key) return;
  const set = await loadIgnorePairs();
  if (!set.has(key)) {
    set.add(key);
    await persistIgnorePairs();
  }
}

async function removeIgnoredPairsForUrl(url) {
  if (!url) return;
  const normalized = normalizeUrlForKey(url);
  if (!normalized) return;
  const set = await loadIgnorePairs();
  let changed = false;
  for (const key of Array.from(set)) {
    const parts = key.split("||");
    if (parts.includes(normalized)) {
      set.delete(key);
      changed = true;
    }
  }
  if (changed) {
    await persistIgnorePairs();
  }
}

// Schedule alarm on install
chrome.runtime.onInstalled.addListener(async () => {
  const { schedule } = await chrome.storage.sync.get('schedule');

  // Set default schedule if not configured
  if (!schedule) {
    await chrome.storage.sync.set({ schedule: 'DAILY_3AM' });
    scheduleAlarm('DAILY_3AM');
  } else {
    scheduleAlarm(schedule);
  }
});

// Helper to schedule alarms
function scheduleAlarm(mode) {
  chrome.alarms.clear('nightly-clean');
  if (mode === 'MANUAL') return;

  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  if (mode === 'WEEKLY_SUN') {
    while (next.getDay() !== 0) next.setDate(next.getDate() + 1);
  }

  chrome.alarms.create('nightly-clean', {
    when: next.getTime(),
    periodInMinutes: mode === 'WEEKLY_SUN' ? 7 * 24 * 60 : 24 * 60
  });
}

// Main cleanup orchestrator
async function runCleanup() {
  if (cleanupTask) {
    console.warn("Cleanup already running; returning existing promise.");
    return cleanupTask;
  }

  if (importInProgress) {
    console.warn("Bookmark import in progress; skipping cleanup.");
    return;
  }

  const task = (async () => {
    const cfg = await chrome.storage.sync.get([
      "apiKey", "baseUrl", "deployment", "embeddingDeployment",
      "enableScraping", "deviceOnly", "previewMode"
    ]);

    if (!cfg.apiKey) {
      console.warn("Azure API key not set");
      return;
    }

    const openai = createOpenAI(cfg);
    const notifier = new NotificationManager();
    const storage = storageManager;
    const limiter = createRateLimiter(8);
    const ignorePairs = await loadIgnorePairs(true);

    try {
      await notifier.ensureProgress('Starting cleanup...');

      // Get all bookmarks
      const roots = await chrome.bookmarks.getTree();
      const leaves = [];
      const walk = (n) => n.children ? n.children.forEach(walk) : leaves.push(n);
      roots.forEach(walk);
      const total = leaves.length;

      // Dedupe
      const { keep, dupes } = await dedupeNodes(leaves, openai, {
        threshold: 0.9,
        localOnly: cfg.deviceOnly,
        notifier,
        total,
        limiter,
        storage,
        enableScraping: cfg.enableScraping !== false,
        ignorePairs
      });

      // Tag
      let tagged = await tagNodes(keep, openai);

      // Suggest folders
      for (const item of tagged) {
        try {
          item.suggestedFolder = await suggestFolders(item, openai);
        } catch (e) {
          console.warn(`Folder suggestion failed for ${item.id}:`, e);
        }
      }

      if (cfg.previewMode) {
        // Save to review queue
        reviewQueue = dupes.map(d => ({
          id: d.id,
          url: d.url,
          title: d.title,
          tags: d.tags,
          similarity: Math.round((d.similarity || 0) * 100),
          duplicateOf: d.duplicateOf
        }));
        await saveQueue();
        await notifier.showComplete({ total, duplicates: dupes.length });
      } else {
        // Auto-apply changes
        await writeTags(tagged, dupes);
        await notifier.showComplete({ total, duplicates: dupes.length });
      }

      // Sync conflicts check
      const syncMgr = new SyncManager();
      const conflicts = await syncMgr.resolveConflicts(leaves, []);
      if (conflicts.length) {
        await notifier.ensureProgress(`${conflicts.length} sync conflicts`);
      }
    } catch (e) {
      console.error('Cleanup failed:', e);
      await notifier.ensureProgress(`Error: ${e?.message || e}`);
    }
  })();

  cleanupTask = task;
  task.finally(() => {
    if (cleanupTask === task) {
      cleanupTask = null;
    }
  });
  return task;
}

// Alarm listener
chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name === "nightly-clean") await runCleanup();
});

// Message handler
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  // Always return true synchronously so Chrome keeps the port open while async work finishes.
  (async () => {
    await loadQueue();

    let replied = false;
    const safeReply = (value) => {
      if (replied) return;
      replied = true;
      try {
        reply(value);
      } catch {
        // Port already closed; ignore.
      }
    };

    try {
      switch (msg?.type) {
        case "RUN_NOW":
          runCleanup()
            .then(() => safeReply(true))
            .catch(() => safeReply(false));
          return;

        case "GET_PENDING":
          safeReply(reviewQueue);
          return;

        case "ACCEPT_MERGE": {
          reviewQueue = reviewQueue.filter(x => x.id !== msg.id);
          await saveQueue();
          safeReply(true);
          return;
        }

        case "REJECT_MERGE": {
          const entry = reviewQueue.find(x => x.id === msg.id);
          reviewQueue = reviewQueue.filter(x => x.id !== msg.id);
          await saveQueue();
          if (entry?.url && entry?.duplicateOf?.url) {
            await addIgnoredPair(entry.url, entry.duplicateOf.url);
          }
          safeReply(true);
          return;
        }

        case "ACCEPT_ALL":
          reviewQueue = [];
          await saveQueue();
          safeReply(true);
          return;

        case "CREATE_BOOKMARK":
          safeReply(await addBookmark(msg.payload));
          return;

        case "UPDATE_BOOKMARK":
          safeReply(await editBookmark(msg.id, msg.changes));
          return;

        case "DELETE_BOOKMARK":
          safeReply(await deleteBookmark(msg.id));
          return;

        case "EXPORT_BOOKMARKS":
          await exportBookmarks();
          safeReply(true);
          return;

        case "IMPORT_BOOKMARKS":
          await importHtml(msg.text, msg.parentId);
          safeReply(true);
          return;

        case "GET_TREE":
          safeReply(await chrome.bookmarks.getTree());
          return;

        case "UPDATE_SCHEDULE":
          scheduleAlarm(msg.mode);
          safeReply(true);
          return;

        case "TEST_CONNECTION": {
          try {
            const client = createOpenAI(msg.config);
            await client.chat([{ role: 'user', content: 'ping' }], { max_tokens: 1 });
            safeReply({ success: true });
          } catch (error) {
            safeReply({ success: false, error: error?.message || String(error) });
          }
          return;
        }

        default:
          safeReply(true);
      }
    } catch (e) {
      console.error('Message handler error:', e);
      safeReply({ ok: false, error: String(e) });
    }
  })();

  return true;
});

chrome.bookmarks.onRemoved.addListener(async (_id, removeInfo) => {
  const url = removeInfo?.node?.url;
  if (!url) return;
  await storageManager.deleteVector(url);
  await removeIgnoredPairsForUrl(url);
});

chrome.bookmarks.onChanged.addListener(async (_id, changeInfo) => {
  if (changeInfo?.url) {
    await storageManager.deleteVector(changeInfo.url);
  }
});

chrome.bookmarks.onImportBegan.addListener(() => {
  importInProgress = true;
});

chrome.bookmarks.onImportEnded.addListener(async () => {
  importInProgress = false;
  try {
    await storageManager.clearAll();
  } catch (e) {
    console.warn('Failed to clear vector cache after import:', e);
  }
  try {
    ignorePairsCache = null;
    await chrome.storage.local.remove(IGNORE_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to reset ignored pairs after import:', e);
  }
  reviewQueue = [];
  await saveQueue();
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command === "run-cleanup") {
    await runCleanup();
  }
});
