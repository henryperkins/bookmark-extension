import { addBookmark } from "./bookmarksCrud.js";

function fallbackParseAnchors(html) {
  const anchors = [];
  const entityMap = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const decode = (value) =>
    value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, ent) => {
      if (ent in entityMap) return entityMap[ent];
      if (ent.startsWith('#x')) return String.fromCharCode(parseInt(ent.slice(2), 16));
      if (ent.startsWith('#')) return String.fromCharCode(parseInt(ent.slice(1), 10));
      return _;
    });

  const re = /<a\b([^>]*?)>(.*?)<\/a>/gis;
  let match;
  while ((match = re.exec(html))) {
    const attrs = match[1] || '';
    const inner = match[2] || '';
    const hrefMatch = attrs.match(/\bhref\s*=\s*("(.*?)"|'(.*?)'|([^>\s]+))/i);
    const rawHref = hrefMatch ? (hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '').trim() : '';
    if (!rawHref) continue;
    const text = decode(inner.replace(/<[^>]*>/g, '')).trim() || rawHref;
    anchors.push({ href: rawHref, text });
  }
  return anchors;
}

export async function importHtml(text, parentId) {
  let anchors = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      anchors = [...doc.querySelectorAll('a[href]')].map(a => ({
        href: a.getAttribute('href'),
        text: (a.textContent || '').trim() || a.getAttribute('href') || ''
      }));
    } catch {
      anchors = fallbackParseAnchors(text);
    }
  } else {
    anchors = fallbackParseAnchors(text);
  }

  for (const anchor of anchors) {
    if (!anchor.href) continue;
    const title = anchor.text || anchor.href;
    try {
      await addBookmark({ parentId, title, url: anchor.href });
    } catch (e) {
      console.warn(`Failed to import bookmark ${anchor.href}:`, e);
    }
  }
}