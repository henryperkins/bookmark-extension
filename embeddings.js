import { cosineSimilarity } from './lib/cosine.js';
import { getPageText } from './scraper.js';
import { DuplicateDetector } from './utils/duplicateDetector.js';
import { makePairKey, normalizeUrlForKey } from './utils/url.js';

export async function embedNode(node, openai, limiter, { allowScrape = true } = {}) {
  let body = '';
  if (allowScrape && node.url) {
    body = (await limiter.execute(() => getPageText(node.url))) || '';
  }

  const parts = [];
  if (node.title) parts.push(node.title);
  if (body) parts.push(body);
  else if (node.url) parts.push(node.url);

  const payload = parts.join('\n\n').trim();
  if (!payload) return new Float32Array(0);

  const { data } = await limiter.execute(() => openai.embed(payload));
  const arr = data?.[0]?.embedding || [];
  return new Float32Array(arr);
}

// Returns { keep, dupes }
export async function dedupeNodes(
  nodes,
  openai,
  {
    threshold = 0.90,
    localOnly = false,
    notifier,
    total = nodes.length,
    limiter,
    storage,
    enableScraping = true,
    ignorePairs
  } = {}
) {
  const detector = new DuplicateDetector(threshold);
  const keep = [];
  const dupes = [];
  const keepVectors = [];
  const ignored = ignorePairs || new Set();

  // Map of normalized URLs to indices in keep array for exact duplicate detection
  const normalizedUrlMap = new Map();

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    notifier?.showProgress(i + 1, total, `Processing ${i + 1}/${total}`);

    // Check for exact normalized URL match first (before computing embeddings)
    const normalizedUrl = n.url ? normalizeUrlForKey(n.url) : '';
    if (normalizedUrl && normalizedUrlMap.has(normalizedUrl)) {
      const matchIdx = normalizedUrlMap.get(normalizedUrl);
      const target = keep[matchIdx];

      // Check if this pair is in the ignore list
      const ignoreKey = makePairKey(n.url, target.url);
      if (!ignoreKey || !ignored.has(ignoreKey)) {
        // Exact URL match found - mark as duplicate without computing embedding
        dupes.push({
          id: n.id,
          title: n.title,
          url: n.url,
          similarity: 1.0, // Exact match
          duplicateOf: { id: target.id, title: target.title, url: target.url }
        });
        continue;
      }
    }

    // No exact match or pair is ignored - proceed with embedding and similarity check
    let v = n.url ? await storage.getVector(n.url, localOnly) : null;
    if (!v || v.length === 0) {
      v = await embedNode(n, openai, limiter, { allowScrape: enableScraping });
      if (n.url) await storage.saveVector(n.url, v, localOnly);
    }

    let best = { idx: -1, sim: -1 };
    for (let k = 0; k < keep.length; k++) {
      const sim = cosineSimilarity(v, keepVectors[k]) || 0;
      if (sim > best.sim) best = { idx: k, sim };
    }

    const target = keep[best.idx];
    const ignoreKey = n.url && target?.url ? makePairKey(n.url, target.url) : '';
    const isIgnoredPair = ignoreKey && ignored.has(ignoreKey);
    const isDupe = !isIgnoredPair && target && detector.isDuplicate(v, keepVectors[best.idx], n.url || '', target.url || '');

    if (isDupe) {
      dupes.push({
        id: n.id,
        title: n.title,
        url: n.url,
        similarity: best.sim,
        duplicateOf: { id: target.id, title: target.title, url: target.url }
      });
    } else {
      keep.push(n);
      keepVectors.push(v);

      // Add normalized URL to map for future exact match checks
      if (normalizedUrl) {
        normalizedUrlMap.set(normalizedUrl, keep.length - 1);
      }
    }
  }

  return { keep, dupes };
}
