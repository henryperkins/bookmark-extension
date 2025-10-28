import { parseBookmarks } from "../importer.js";
import { addBookmark } from "../bookmarksCrud.js";
import { createRateLimiter } from "../utils/rateLimiter.js";
import { normalizeUrlForKey, isBrowserInternalUrl } from "../utils/url.js";
import { createOpenAI } from "../openaiClient.js";
import { tagNodes } from "../tagger.js";
import { suggestFolders } from "../utils/folderOrganizer.js";
import { writeTags } from "../writer.js";
import { getPageText } from "../scraper.js";

const URL_INDEX_KEY = "urlIndex";
export const IMPORT_PAYLOAD_PREFIX = "importPayload_";
const IMPORT_STATE_PREFIX = "importState_";
export const ENRICH_PAYLOAD_PREFIX = "enrichPayload_";
export const JOB_META_PREFIX = "jobMeta_";
const ROOT_REF = "__root__";

let listenersWired = false;

function getJobMetaKey(jobId) {
  return `${JOB_META_PREFIX}${jobId}`;
}

function getImportStateKey(jobId) {
  return `${IMPORT_STATE_PREFIX}${jobId}`;
}

function getImportPayloadKey(jobId) {
  return `${IMPORT_PAYLOAD_PREFIX}${jobId}`;
}

function getEnrichPayloadKey(jobId) {
  return `${ENRICH_PAYLOAD_PREFIX}${jobId}`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForKey(key, timeoutMs = 8000, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    const result = await chrome.storage.local.get(key);
    if (Object.prototype.hasOwnProperty.call(result, key) && result[key] != null) {
      return result[key];
    }
    await sleep(intervalMs);
  }
  return undefined;
}

async function loadJobMeta(jobId) {
  const key = getJobMetaKey(jobId);
  const meta = await waitForKey(key, 8000, 50);
  if (!meta || typeof meta !== "object") return null;
  return meta;
}

async function getUrlIndex() {
  const result = await chrome.storage.local.get(URL_INDEX_KEY);
  const idx = result[URL_INDEX_KEY];
  if (idx && typeof idx === "object") return { ...idx };
  return {};
}

async function setUrlIndex(index) {
  try {
    await chrome.storage.local.set({ [URL_INDEX_KEY]: index });
  } catch (error) {
    console.warn("Failed to persist URL index:", error);
  }
}

function collectOperations(tree, options) {
  const { parentRef = null, existingIndex, seenUrls } = options;
  const operations = [];
  const stats = options.stats;

  for (const node of tree) {
    if (node.type === "folder") {
      const opIndex = options.nextIndex.value++;
      operations.push({
        opIndex,
        kind: "folder",
        title: node.title || "Untitled Folder",
        parentRef
      });

      if (Array.isArray(node.children) && node.children.length) {
        const childOptions = {
          ...options,
          parentRef: opIndex
        };
        const childResult = collectOperations(node.children, childOptions);
        operations.push(...childResult.operations);
      }
    } else if (node.type === "bookmark") {
      stats.totalCandidates = (stats.totalCandidates || 0) + 1;
      const url = (node.url || "").trim();
      if (!url) {
        stats.invalid = (stats.invalid || 0) + 1;
        continue;
      }
      if (isBrowserInternalUrl(url)) {
        stats.invalid = (stats.invalid || 0) + 1;
        continue;
      }
      const normalized = normalizeUrlForKey(url);
      if (!normalized) {
        stats.invalid = (stats.invalid || 0) + 1;
        continue;
      }
      if (seenUrls.has(normalized) || existingIndex[normalized]) {
        stats.duplicates = (stats.duplicates || 0) + 1;
        continue;
      }

      seenUrls.add(normalized);
      stats.valid = (stats.valid || 0) + 1;
      operations.push({
        opIndex: options.nextIndex.value++,
        kind: "bookmark",
        title: node.title || url,
        url,
        parentRef
      });
    }
  }

  return { operations, stats };
}

async function loadImportState(jobId) {
  const key = getImportStateKey(jobId);
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

async function saveImportState(jobId, state) {
  const key = getImportStateKey(jobId);
  await chrome.storage.local.set({ [key]: state });
}

export async function rebuildUrlIndex() {
  try {
    const roots = await chrome.bookmarks.getTree();
    const index = {};
    const walk = (node) => {
      if (node.url) {
        const normalized = normalizeUrlForKey(node.url);
        if (normalized) {
          index[normalized] = true;
        }
      }
      if (Array.isArray(node.children)) {
        node.children.forEach(walk);
      }
    };
    roots.forEach(walk);
    await setUrlIndex(index);
  } catch (error) {
    console.warn("Failed to rebuild URL index:", error);
  }
}

export function wireUrlIndexListeners() {
  if (listenersWired) return;
  listenersWired = true;

  chrome.bookmarks.onCreated.addListener(async (_id, node) => {
    if (!node?.url) return;
    const index = await getUrlIndex();
    const normalized = normalizeUrlForKey(node.url);
    if (normalized) {
      index[normalized] = true;
      await setUrlIndex(index);
    }
  });

  chrome.bookmarks.onRemoved.addListener(async (_id, info) => {
    const url = info?.node?.url;
    if (!url) return;
    const index = await getUrlIndex();
    const normalized = normalizeUrlForKey(url);
    if (normalized && index[normalized]) {
      delete index[normalized];
      await setUrlIndex(index);
    }
  });

  chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
    if (!changeInfo?.url) {
      // Fallback to rebuilding if URL changed but not provided.
      await rebuildUrlIndex();
      return;
    }

    const index = await getUrlIndex();
    const normalized = normalizeUrlForKey(changeInfo.url);
    if (normalized) {
      index[normalized] = true;
      await setUrlIndex(index);
    }
  });
}

function ensureImportStateDefaults(state, parentId) {
  if (!state || typeof state !== "object") {
    return {
      parentId,
      operations: [],
      cursor: 0,
      folderMap: { [ROOT_REF]: parentId },
      stats: {
        totalCandidates: 0,
        valid: 0,
        duplicates: 0,
        invalid: 0,
        createdFolders: 0,
        createdBookmarks: 0,
        failed: 0
      },
      createdAt: Date.now()
    };
  }

  if (!state.folderMap) {
    state.folderMap = { [ROOT_REF]: parentId };
  } else if (!state.folderMap[ROOT_REF]) {
    state.folderMap[ROOT_REF] = parentId;
  }

  if (!state.stats) {
    state.stats = {};
  }

  return state;
}

async function runImportInitializing(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "import") {
    return { completed: true };
  }

  const payloadKey = getImportPayloadKey(ctx.jobId);
  const payload = await waitForKey(payloadKey, 8000, 50);
  if (!payload) {
    throw new Error("Import payload missing");
  }

  const parentId = payload.parentId || "1";
  const state = ensureImportStateDefaults(await loadImportState(ctx.jobId), parentId);
  await saveImportState(ctx.jobId, state);

  // Seed progress with zero total units until scanning fills it in.
  ctx.progressCallback(0, 1);

  return {
    completed: true,
    summary: {
      totalBookmarks: 0
    }
  };
}

async function runImportScanning(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "import") {
    return { completed: true };
  }

  const payloadKey = getImportPayloadKey(ctx.jobId);
  const payload = await waitForKey(payloadKey, 8000, 50);
  if (!payload) {
    throw new Error("Import payload missing");
  }

  const html = payload.html || "";
  const parsed = parseBookmarks(html);
  const index = await getUrlIndex();
  const seen = new Set();

  const state = ensureImportStateDefaults(await loadImportState(ctx.jobId), payload.parentId || "1");
  state.operations = [];
  state.cursor = 0;
  state.stats = {
    totalCandidates: 0,
    valid: 0,
    duplicates: 0,
    invalid: 0,
    createdFolders: state.stats?.createdFolders || 0,
    createdBookmarks: state.stats?.createdBookmarks || 0,
    failed: state.stats?.failed || 0
  };

  const collectorOptions = {
    parentRef: null,
    existingIndex: index,
    seenUrls: seen,
    stats: state.stats,
    nextIndex: { value: 0 }
  };

  const { operations } = collectOperations(parsed, collectorOptions);
  state.operations = operations;
  state.totalOperations = operations.length;
  await saveImportState(ctx.jobId, state);

  ctx.progressCallback(operations.length, operations.length || 1);

  return {
    completed: true,
    summary: {
      totalBookmarks: state.stats.valid || 0,
      duplicatesFound: state.stats.duplicates || 0
    }
  };
}

async function runImportGrouping(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "import") {
    return { completed: true };
  }

  // No grouping phase for imports; treat as no-op.
  ctx.progressCallback(1, 1);
  return { completed: true };
}

async function runImportResolving(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "import") {
    return { completed: true };
  }

  const state = ensureImportStateDefaults(await loadImportState(ctx.jobId), meta.parentId || "1");
  if (!Array.isArray(state.operations) || state.operations.length === 0) {
    ctx.progressCallback(0, 1);
    return { completed: true };
  }

  const total = state.operations.length;
  const limiter = createRateLimiter(8);
  let index = await getUrlIndex();
  const BATCH_SIZE = 300;

  while (state.cursor < total) {
    const batchEnd = Math.min(state.cursor + BATCH_SIZE, total);

    for (let i = state.cursor; i < batchEnd; i++) {
      const op = state.operations[i];
      const parentKey = op.parentRef == null ? ROOT_REF : String(op.parentRef);
      const parentId = state.folderMap[parentKey] || state.folderMap[ROOT_REF] || meta.parentId || "1";

      try {
        if (op.kind === "folder") {
          const created = await limiter.execute(() =>
            addBookmark({
              parentId,
              title: op.title || "Untitled Folder"
            })
          );
          if (created?.id) {
            state.folderMap[String(op.opIndex)] = created.id;
            state.stats.createdFolders = (state.stats.createdFolders || 0) + 1;
          }
        } else if (op.kind === "bookmark") {
          const created = await limiter.execute(() =>
            addBookmark({
              parentId,
              title: op.title || op.url,
              url: op.url
            })
          );

          if (created?.url) {
            const normalized = normalizeUrlForKey(created.url);
            if (normalized) {
              index[normalized] = true;
            }
          }

          state.stats.createdBookmarks = (state.stats.createdBookmarks || 0) + 1;
        }
      } catch (error) {
        console.warn("Failed to execute import operation:", op, error);
        state.stats.failed = (state.stats.failed || 0) + 1;
      }
    }

    state.cursor = batchEnd;
    ctx.progressCallback(state.cursor, total);
    await saveImportState(ctx.jobId, state);
    await setUrlIndex(index);
    await sleep(0);
  }

  return {
    completed: true,
    processedUnits: total,
    totalUnits: total
  };
}

async function runImportVerifying(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "import") {
    return { completed: true };
  }
  ctx.progressCallback(1, 1);
  return { completed: true };
}

async function runImportSummarizing(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "import") {
    return { completed: true };
  }

  const state = await loadImportState(ctx.jobId);
  const payloadKey = getImportPayloadKey(ctx.jobId);
  const metaKey = getJobMetaKey(ctx.jobId);

  await chrome.storage.local.remove([payloadKey, getImportStateKey(ctx.jobId), metaKey].filter(Boolean));

  const stats = state?.stats || {};
  return {
    completed: true,
    summary: {
      totalBookmarks: stats.valid || 0,
      duplicatesFound: stats.duplicates || 0,
      duplicatesResolved: stats.duplicates || 0,
      autoApplied: true,
      reviewQueueSize: 0
    }
  };
}

async function runEnrichInitializing(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "enrich-one") {
    return { completed: true };
  }
  ctx.progressCallback(0, 1);
  return { completed: true };
}

async function runEnrichScanning(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "enrich-one") {
    return { completed: true };
  }
  ctx.progressCallback(1, 1);
  return { completed: true };
}

async function runEnrichGrouping(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "enrich-one") {
    return { completed: true };
  }
  ctx.progressCallback(1, 1);
  return { completed: true };
}

async function loadEnrichmentConfig() {
  const cfg = await chrome.storage.sync.get([
    "apiKey",
    "baseUrl",
    "deployment",
    "embeddingDeployment",
    "apiVersion",
    "deviceOnly",
    "enableScraping",
    "previewMode"
  ]);
  return cfg;
}

async function runEnrichResolving(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "enrich-one") {
    return { completed: true };
  }

  const payloadKey = getEnrichPayloadKey(ctx.jobId);
  const payload = await waitForKey(payloadKey, 8000, 50);
  if (!payload?.id) {
    throw new Error("Enrichment payload missing bookmark id");
  }

  const [node] = await chrome.bookmarks.get(payload.id);
  if (!node?.url) {
    return { completed: true, summary: { totalBookmarks: 0 } };
  }

  let openai = null;
  const cfg = await loadEnrichmentConfig();
  if (cfg.apiKey && cfg.baseUrl && cfg.deployment) {
    try {
      openai = createOpenAI(cfg);
    } catch (error) {
      console.warn("Failed to instantiate OpenAI client:", error);
    }
  }

  let enriched = null;
  if (openai) {
    try {
      const content = cfg.enableScraping === false ? "" : await getPageText(node.url);
      const tagged = await tagNodes([{ id: node.id, title: node.title, url: node.url, content }], openai, {
        onProgress: (processed) => {
          ctx.progressCallback(Math.min(processed, 1), 1);
        }
      });
      if (tagged && tagged.length) {
        enriched = tagged[0];
        await writeTags(tagged);
        try {
          enriched.suggestedFolder = await suggestFolders(enriched, openai);
        } catch (folderError) {
          console.warn("Folder suggestion failed:", folderError);
        }
      }
    } catch (error) {
      console.warn("Enrichment failed:", error);
    }
  }

  if (enriched) {
    await chrome.storage.local.set({
      [`bookmarkEnhancement_${node.id}`]: {
        id: node.id,
        tags: enriched.tags || [],
        category: enriched.category || "",
        suggestedFolder: enriched.suggestedFolder || "",
        enrichedAt: Date.now()
      }
    });
  }

  ctx.progressCallback(1, 1);

  return {
    completed: true,
    summary: {
      totalBookmarks: 1,
      autoApplied: Boolean(enriched),
      reviewQueueSize: 0
    }
  };
}

async function runEnrichVerifying(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "enrich-one") {
    return { completed: true };
  }
  ctx.progressCallback(1, 1);
  return { completed: true };
}

async function runEnrichSummarizing(ctx) {
  const meta = await loadJobMeta(ctx.jobId);
  if (!meta || meta.type !== "enrich-one") {
    return { completed: true };
  }

  const payloadKey = getEnrichPayloadKey(ctx.jobId);
  const metaKey = getJobMetaKey(ctx.jobId);
  await chrome.storage.local.remove([payloadKey, metaKey].filter(Boolean));

  return {
    completed: true,
    summary: {
      totalBookmarks: 1,
      reviewQueueSize: 0
    }
  };
}

function buildStageExecutor(stage) {
  return {
    async execute(ctx) {
      const meta = await loadJobMeta(ctx.jobId);
      const type = meta?.type;

      switch (stage) {
        case "initializing":
          if (type === "import") return runImportInitializing(ctx);
          if (type === "enrich-one") return runEnrichInitializing(ctx);
          return { completed: true };
        case "scanning":
          if (type === "import") return runImportScanning(ctx);
          if (type === "enrich-one") return runEnrichScanning(ctx);
          return { completed: true };
        case "grouping":
          if (type === "import") return runImportGrouping(ctx);
          if (type === "enrich-one") return runEnrichGrouping(ctx);
          return { completed: true };
        case "resolving":
          if (type === "import") return runImportResolving(ctx);
          if (type === "enrich-one") return runEnrichResolving(ctx);
          return { completed: true };
        case "verifying":
          if (type === "import") return runImportVerifying(ctx);
          if (type === "enrich-one") return runEnrichVerifying(ctx);
          return { completed: true };
        case "summarizing":
          if (type === "import") return runImportSummarizing(ctx);
          if (type === "enrich-one") return runEnrichSummarizing(ctx);
          return { completed: true };
        default:
          return { completed: true };
      }
    }
  };
}

export function registerImportJobStages(jobSystem) {
  const stages = ["initializing", "scanning", "grouping", "resolving", "verifying", "summarizing"];
  for (const stage of stages) {
    jobSystem.registerStageExecutor(stage, buildStageExecutor(stage));
  }
}
