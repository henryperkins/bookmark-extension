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
import { initializeJobSystem, JobSystemCommands, getJobSystem } from "./background/jobSystem.js";
import { registerImportJobStages, wireUrlIndexListeners, rebuildUrlIndex, ensureUrlIndexIntegrity, JOB_META_PREFIX, IMPORT_PAYLOAD_PREFIX, ENRICH_PAYLOAD_PREFIX } from "./background/importStages.js";
import { ConnectionTestStageExecutor } from './background/connectionStage.js';

let reviewQueue = [];
let ignorePairsCache = null;
let cleanupTask = null;
let importInProgress = false;
const storageManager = new StorageManager();
const bookmarkUrlCache = new Map();

const IGNORE_STORAGE_KEY = "ignoredDuplicates";

(async () => {
  try {
    const jobSystem = await initializeJobSystem();
    registerImportJobStages(jobSystem);
    wireUrlIndexListeners();
    const { urlIndex: existingIndex } = await chrome.storage.local.get("urlIndex");
    if (!existingIndex) {
      await rebuildUrlIndex();
    } else {
      await ensureUrlIndexIntegrity();
    }
  } catch (error) {
    console.warn("Job system bootstrap failed:", error);
  }
})();

(async () => {
  try {
    const roots = await chrome.bookmarks.getTree();
    const record = (node) => {
      if (node.url) bookmarkUrlCache.set(node.id, node.url);
      (node.children || []).forEach(record);
    };
    roots.forEach(record);
  } catch (error) {
    console.warn("Failed to hydrate bookmark URL cache:", error);
  }
})();

async function queueImportJob(html, parentId = "1") {
  const result = await JobSystemCommands.startJob("popup", { metadata: { jobType: "import" } });
  if (!result.success || !result.jobId) {
    throw new Error(result.error || "Failed to start import job");
  }

  const jobId = result.jobId;
  const payload = {
    [`${JOB_META_PREFIX}${jobId}`]: { type: "import", parentId },
    [`${IMPORT_PAYLOAD_PREFIX}${jobId}`]: { html, parentId }
  };

  try {
    await chrome.storage.local.set(payload);
    return jobId;
  } catch (error) {
    console.warn("Failed to persist import payload:", error);
    await chrome.storage.local.remove(Object.keys(payload));
    await JobSystemCommands.cancelJob().catch(() => {});
    throw error;
  }
}

async function queueEnrichJob(bookmarkId) {
  if (!bookmarkId) return null;

  const result = await JobSystemCommands.startJob("popup", { metadata: { jobType: "enrich-one" } });
  if (!result.success || !result.jobId) {
    return null;
  }

  const jobId = result.jobId;
  const payload = {
    [`${JOB_META_PREFIX}${jobId}`]: { type: "enrich-one" },
    [`${ENRICH_PAYLOAD_PREFIX}${jobId}`]: { id: bookmarkId }
  };

  try {
    await chrome.storage.local.set(payload);
    return jobId;
  } catch (error) {
    console.warn("Failed to persist enrichment payload:", error);
    await chrome.storage.local.remove(Object.keys(payload));
    await JobSystemCommands.cancelJob().catch(() => {});
    return null;
  }
}

async function isDuplicateUrl(url) {
  if (!url) return false;
  const normalized = normalizeUrlForKey(url);
  if (!normalized) return false;
  const { urlIndex } = await chrome.storage.local.get("urlIndex");
  const entry = urlIndex && urlIndex[normalized];
  if (!entry) return false;
  if (Array.isArray(entry)) {
    return entry.length > 0;
  }
  return Boolean(entry);
}

function shouldQueueImport(html) {
  if (!html || typeof html !== "string") return false;
  if (html.length > 500_000) return true;
  const dtMatches = html.match(/<DT/gi)?.length || 0;
  return dtMatches >= 800;
}

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
      "apiVersion", "enableScraping", "deviceOnly", "previewMode"
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

    // Progress snapshot helpers (stage weights and aggregator)
    const STAGE_ORDER = ['initializing','scanning','grouping','resolving','verifying','summarizing'];
    const STAGE_WEIGHTS = { initializing: 0.05, scanning: 0.30, grouping: 0.10, resolving: 0.50, verifying: 0.05, summarizing: 0.05 };
    const stageIndexMap = Object.fromEntries(STAGE_ORDER.map((s, i) => [s, i]));

    function computeWeightedPercent(stage, stagePercent) {
      let sum = 0;
      for (const s of STAGE_ORDER) {
        if (s === stage) {
          sum += (STAGE_WEIGHTS[s] || 0) * Math.max(0, Math.min(1, stagePercent || 0));
          break;
        } else {
          sum += STAGE_WEIGHTS[s] || 0;
        }
      }
      return Math.max(0, Math.min(1, sum));
    }

    async function setSnapshot(stage, processedUnits, totalUnits, activity, { status = 'running', indeterminate = false } = {}) {
      const total = Number.isFinite(totalUnits) ? totalUnits : 0;
      const processed = Number.isFinite(processedUnits) ? processedUnits : 0;
      const stagePercent = total ? Math.max(0, Math.min(1, processed / Math.max(1, total))) : 0;
      const weightedPercent = computeWeightedPercent(stage, stagePercent);
      const snapshot = {
        jobId: notifier.id || 'bookmark-progress',
        status,
        stage,
        stageIndex: stageIndexMap[stage] ?? 0,
        totalUnits: total,
        processedUnits: processed,
        stagePercent,
        weightedPercent,
        indeterminate: Boolean(indeterminate),
        activity,
        timestamp: new Date().toISOString()
      };
      try {
        await chrome.storage.local.set({ dedupeJob: snapshot });
      } catch {
        // ignore storage failures
      }
    }

    try {
      await notifier.ensureProgress('Starting cleanup...');

      // Get all bookmarks
      const roots = await chrome.bookmarks.getTree();
      const leaves = [];
      const walk = (n) => {
        if (n.children && n.children.length) {
          n.children.forEach(walk);
        } else if (n.url) {
          leaves.push(n);
        }
      };
      roots.forEach(walk);
      const total = leaves.length;

      // Seed popup with initial scanning stage
      try {
        await setSnapshot('scanning', 0, total, `Processing 0/${total}`, { indeterminate: !total });
      } catch {}

      // Dedupe
      const { keep, dupes } = await dedupeNodes(leaves, openai, {
        threshold: 0.90, // Align with README
        localOnly: cfg.deviceOnly,
        notifier,
        total,
        limiter,
        storage,
        enableScraping: cfg.enableScraping !== false,
        ignorePairs
      });

      // Stage: grouping (complete)
      await setSnapshot('grouping', 1, 1, `Found ${dupes.length} duplicate(s)`, { indeterminate: false });
// Tag
const resolveTotal = (keep.length || 0) * 2 || 1;
let resolveProcessed = 0;
let tagged = await tagNodes(keep, openai, {
  onProgress: (i, totalI) => {
    resolveProcessed = Math.min(resolveTotal, i);
    try { setSnapshot('resolving', resolveProcessed, resolveTotal, `Tagging ${i}/${totalI}`, { indeterminate: false }); } catch {}
  }
});


      // Suggest folders
      for (let i = 0; i < tagged.length; i++) {
        const item = tagged[i];
        try {
          item.suggestedFolder = await suggestFolders(item, openai);
        } catch (e) {
          console.warn(`Folder suggestion failed for ${item.id}:`, e);
        }
        resolveProcessed = (keep.length || 0) + (i + 1);
        await setSnapshot('resolving', resolveProcessed, resolveTotal, `Suggesting folders ${i + 1}/${tagged.length}`, { indeterminate: false });
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
        await setSnapshot('summarizing', 1, 1, 'Creating summary…', { indeterminate: false });
        await notifier.showComplete({ total, duplicates: dupes.length });
      } else {
        // Auto-apply changes
        await setSnapshot('resolving', resolveTotal - 1, resolveTotal, 'Applying changes…', { indeterminate: false });
        await writeTags(tagged, dupes);
        await setSnapshot('resolving', resolveTotal, resolveTotal, 'Applied changes', { indeterminate: false });
        await setSnapshot('summarizing', 1, 1, 'Creating summary…', { indeterminate: false });
        await notifier.showComplete({ total, duplicates: dupes.length });
      }

      // Sync conflicts check
      const syncMgr = new SyncManager();
      await setSnapshot('verifying', 0, 1, 'Verifying integrity…', { indeterminate: true });
      const conflicts = await syncMgr.resolveConflicts(leaves, []);
      await setSnapshot('verifying', 1, 1, conflicts.length ? `${conflicts.length} sync conflicts` : 'Verification complete', { indeterminate: false });
      if (conflicts.length) {
        await notifier.ensureProgress(`${conflicts.length} sync conflicts`);
      }
    } catch (e) {
      console.error('Cleanup failed:', e);
      await notifier.showError(e?.message || e);
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
          const entry = reviewQueue.find(x => x.id === msg.id);
          reviewQueue = reviewQueue.filter(x => x.id !== msg.id);
          await saveQueue();
          if (entry?.id) {
            try { await deleteBookmark(entry.id); } catch (e) { console.warn('Failed to delete accepted duplicate:', e); }
          }
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

        case "ACCEPT_ALL": {
          const entries = reviewQueue.slice();
          reviewQueue = [];
          await saveQueue();
          await Promise.all(entries.map(e => deleteBookmark(e.id).catch(() => {})));
          safeReply(true);
          return;
        }

        case "CHECK_DUPLICATE_URL": {
          try {
            safeReply({ exists: await isDuplicateUrl(msg.url) });
          } catch (error) {
            console.warn("Duplicate lookup failed:", error);
            safeReply({ exists: false, error: String(error) });
          }
          return;
        }

        case "CREATE_BOOKMARK": {
          try {
            const created = await addBookmark(msg.payload);
            safeReply(created);
            if (created?.id) {
              queueEnrichJob(created.id).catch((error) => {
                console.warn("Failed to queue enrichment job:", error);
              });
            }
          } catch (error) {
            console.warn("Failed to create bookmark:", error);
            safeReply(null);
          }
          return;
        }

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

        case "IMPORT_BOOKMARKS": {
          const html = msg?.text || "";
          const parentId = msg?.parentId || "1";
          try {
            if (shouldQueueImport(html)) {
              const jobId = await queueImportJob(html, parentId);
              safeReply({ success: true, queued: true, jobId });
            } else {
              await importHtml(html, parentId);
              safeReply({ success: true, queued: false });
            }
          } catch (error) {
            console.warn("Queued import failed, attempting direct import:", error);
            try {
              await importHtml(html, parentId);
              safeReply({ success: true, queued: false, fallback: true });
            } catch (fallbackError) {
              console.error("Fallback import failed:", fallbackError);
              safeReply({ success: false, error: String(fallbackError) });
            }
          }
          return;
        }

        case "GET_TREE":
          safeReply(await chrome.bookmarks.getTree());
          return;

        case "UPDATE_SCHEDULE":
          scheduleAlarm(msg.mode);
          safeReply(true);
          return;

        case "TEST_CONNECTION": {
          const jobSystem = getJobSystem();
          if (jobSystem) {
            const executor = new ConnectionTestStageExecutor(msg.config);
            jobSystem.registerStageExecutor('testingConnection', executor);
          }
          const result = await JobSystemCommands.startJob("popup", {
            metadata: { jobType: "test-connection" }
          });
          safeReply(result);
          return;
        }

        case "GET_JOB_STATUS": {
          const status = await JobSystemCommands.getJobStatus();
          if (status.success) {
            if (status.snapshot) {
              safeReply(status.snapshot);
              return;
            }
            // Fall through to legacy snapshot if no active job.
          }
          try {
            const { dedupeJob } = await chrome.storage.local.get('dedupeJob');
            safeReply(dedupeJob || null);
          } catch (_e) {
            safeReply(null);
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

chrome.bookmarks.onCreated.addListener((_id, node) => {
  if (!node?.id) return;
  if (node.url) {
    bookmarkUrlCache.set(node.id, node.url);
  } else {
    bookmarkUrlCache.delete(node.id);
  }
});

chrome.bookmarks.onRemoved.addListener(async (_id, removeInfo) => {
  const urls = new Set();

  const purge = (node) => {
    if (!node) return;
    if (node.id) bookmarkUrlCache.delete(node.id);
    if (node.url) urls.add(node.url);
    (node.children || []).forEach(purge);
  };

  if (removeInfo?.node) {
    purge(removeInfo.node);
  } else if (removeInfo?.parentId) {
    bookmarkUrlCache.delete(removeInfo.parentId);
  }

  for (const url of urls) {
    await storageManager.deleteVector(url);
    await storageManager.deleteVectorByNormalized(normalizeUrlForKey(url));
    await removeIgnoredPairsForUrl(url);
  }
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  if (changeInfo?.url) {
    const previousUrl = bookmarkUrlCache.get(id);
    if (previousUrl && previousUrl !== changeInfo.url) {
      await storageManager.deleteVector(previousUrl);
      await storageManager.deleteVectorByNormalized(normalizeUrlForKey(previousUrl));
    }
    bookmarkUrlCache.set(id, changeInfo.url);
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
  bookmarkUrlCache.clear();
  try {
    const nodes = await chrome.bookmarks.getTree();
    const record = (node) => {
      if (node.url) bookmarkUrlCache.set(node.id, node.url);
      (node.children || []).forEach(record);
    };
    nodes.forEach(record);
  } catch (error) {
    console.warn("Failed to rebuild bookmark URL cache after import:", error);
  }
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command === "run-cleanup") {
    await runCleanup();
  }
});
