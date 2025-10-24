import { cosineSimilarity } from "./lib/cosine.js";
import { getPageText } from "./scraper.js";
import { DuplicateDetector } from "./utils/duplicateDetector.js";
import { makePairKey } from "./utils/url.js";

export async function embedNode(node, openai, limiter, { allowScrape = true } = {}) {
  let body = "";
  if (allowScrape && node.url) {
    body = (await limiter.execute(() => getPageText(node.url))) || "";
  }

  const parts = [];
  if (node.title) parts.push(node.title);
  if (body) parts.push(body);
  else if (node.url) parts.push(node.url);

  const payload = parts.join("\n\n").trim();
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

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    let v = n.url ? await storage.getVector(n.url, localOnly) : null;
    if (!v || v.length === 0) {
      v = await embedNode(n, openai, limiter, { allowScrape: enableScraping });
      if (n.url) await storage.saveVector(n.url, v, localOnly);
    }
    notifier?.showProgress(i + 1, total, `Processing ${i + 1}/${total}`);

    let best = { idx: -1, sim: -1 };
    for (let k = 0; k < keep.length; k++) {
      const sim = cosineSimilarity(v, keepVectors[k]) || 0;
      if (sim > best.sim) best = { idx: k, sim };
    }

    const target = keep[best.idx];
    const ignoreKey = n.url && target?.url ? makePairKey(n.url, target.url) : "";
    const isIgnoredPair = ignoreKey && ignored.has(ignoreKey);
    const isDupe = !isIgnoredPair && target && detector.isDuplicate(v, keepVectors[best.idx], n.url || "", target.url || "");

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
    }
  }

  return { keep, dupes };
}
