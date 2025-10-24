import { isLocalNetworkUrl } from "./utils/url.js";

chrome.runtime.onMessage.addListener(async (msg, _sender, reply) => {
  if (msg?.target !== 'offscreen' || msg?.type !== 'SCRAPE') return;

  try {
    // Validate URL
    if (!/^https?:\/\//i.test(msg.url)) {
      throw new Error('Invalid URL');
    }

    if (isLocalNetworkUrl(msg.url)) {
      throw new Error('Local network URLs are blocked');
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(msg.url, {
      mode: 'cors',
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = extractMeaningfulText(doc);

    reply({ ok: true, text });
  } catch (e) {
    reply({ ok: false, error: String(e), text: '' });
  }

  return true; // Keep channel open for async
});

function extractMeaningfulText(doc) {
  // Try common content containers first
  const candidates = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '#content',
    '.post',
    '.article-body'
  ];

  for (const sel of candidates) {
    const el = doc.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t && t.length > 200) {
      return t.slice(0, 4000);
    }
  }

  // Fallback to meta description + first paragraph
  const meta = doc.querySelector('meta[name="description"]')?.content || '';
  const firstP = doc.querySelector('p')?.textContent || '';
  return (meta + '\n\n' + firstP).trim().slice(0, 4000);
}
