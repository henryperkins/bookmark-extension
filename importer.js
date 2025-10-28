import { addBookmark } from "./bookmarksCrud.js";
import { normalizeUrlForKey, isBrowserInternalUrl } from "./utils/url.js";

/**
 * Decode HTML entities in text content
 */
function decodeHtmlEntities(value) {
  if (!value) return "";
  const entityMap = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, ent) => {
    if (ent in entityMap) return entityMap[ent];
    if (ent.startsWith('#x')) return String.fromCharCode(parseInt(ent.slice(2), 16));
    if (ent.startsWith('#')) return String.fromCharCode(parseInt(ent.slice(1), 10));
    return `&${ent};`;
  });
}

/**
 * Parse bookmark HTML using DOMParser (modern browsers)
 */
function parseDomBookmarks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function processContainer(container) {
    const items = [];
    const children = Array.from(container.children);
    let skipNext = false;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      // Skip if flagged from previous iteration
      if (skipNext) {
        skipNext = false;
        continue;
      }

      // Skip paragraph tags
      if (child.tagName === 'P') continue;

      if (child.tagName === 'DT') {
        // Check if this DT contains a folder (H3 element)
        const h3 = child.querySelector(':scope > H3');
        if (h3) {
          const title = decodeHtmlEntities(h3.textContent || '').trim();
          const folder = { type: 'folder', title, children: [] };

          // Look for the next sibling that is a DL (contains folder children)
          let nextSibling = children[i + 1];
          let nextIdx = i + 1;

          // Skip any <p> tags
          while (nextSibling && nextSibling.tagName === 'P') {
            nextIdx++;
            nextSibling = children[nextIdx];
          }

          if (nextSibling && nextSibling.tagName === 'DL') {
            folder.children = processContainer(nextSibling);
            // Mark to skip the DL in next iteration
            if (nextIdx === i + 1) {
              skipNext = true;
            }
          }

          items.push(folder);
          continue;
        }

        // Check if this DT contains a bookmark (A element)
        const anchor = child.querySelector(':scope > A');
        if (anchor) {
          // DOMParser automatically decodes HTML entities in attributes
          const href = (anchor.getAttribute('HREF') || anchor.getAttribute('href') || '').trim();
          const title = decodeHtmlEntities(anchor.textContent || '').trim();
          items.push({ type: 'bookmark', url: href, title });
        }
      }
    }

    return items;
  }

  // Find the main DL container
  const mainDl = doc.querySelector('DL');
  if (!mainDl) return [];

  return processContainer(mainDl);
}

/**
 * Fallback regex-based parser for environments without DOMParser
 */
function fallbackParseBookmarks(html) {
  const items = [];
  const stack = [{ children: items }];

  // Regex patterns for Netscape bookmark format
  const patterns = [
    { type: 'folder-start', re: /<DT>\s*<H3[^>]*>(.*?)<\/H3>/gi },
    { type: 'bookmark', re: /<DT>\s*<A\s+([^>]*?)>(.*?)<\/A>/gi },
    { type: 'dl-open', re: /<DL[^>]*>/gi },
    { type: 'dl-close', re: /<\/DL>/gi }
  ];

  // Find all tokens with their positions
  const tokens = [];
  for (const { type, re } of patterns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      tokens.push({
        type,
        pos: match.index,
        data: match
      });
    }
  }

  // Sort tokens by position
  tokens.sort((a, b) => a.pos - b.pos);

  // Build tree structure
  let currentContainer = stack[0];
  let pendingFolder = null;

  for (const token of tokens) {
    if (token.type === 'folder-start') {
      const title = decodeHtmlEntities(token.data[1]).trim();
      pendingFolder = { type: 'folder', title, children: [] };
      currentContainer.children.push(pendingFolder);
    } else if (token.type === 'dl-open' && pendingFolder) {
      // DL open after folder means the folder has children
      stack.push(pendingFolder);
      currentContainer = pendingFolder;
      pendingFolder = null;
    } else if (token.type === 'bookmark') {
      const attrs = token.data[1];
      const text = token.data[2];
      const hrefMatch = attrs.match(/\bHREF\s*=\s*["']([^"']+)["']/i);
      const url = hrefMatch ? decodeHtmlEntities(hrefMatch[1]) : '';
      const title = decodeHtmlEntities(text.replace(/<[^>]*>/g, '')).trim();
      currentContainer.children.push({ type: 'bookmark', url, title });
    } else if (token.type === 'dl-close') {
      // Close current folder and go back to parent
      if (stack.length > 1) {
        stack.pop();
        currentContainer = stack[stack.length - 1];
      }
      pendingFolder = null;
    }
  }

  return items;
}

/**
 * Parse bookmark Netscape HTML into a nested tree without performing writes.
 * @param {string} html
 * @returns {Array<{type: 'folder'|'bookmark', title?: string, url?: string, children?: any[]}>}
 */
export function parseBookmarks(html) {
  if (!html || typeof html !== "string") return [];

  try {
    if (typeof DOMParser !== "undefined") {
      return parseDomBookmarks(html);
    }
    return fallbackParseBookmarks(html);
  } catch (error) {
    console.warn("parseBookmarks failed, falling back to regex parser:", error);
    try {
      return fallbackParseBookmarks(html);
    } catch (fallbackError) {
      console.warn("Fallback parser also failed:", fallbackError);
      return [];
    }
  }
}

/**
 * Import bookmarks from Netscape HTML format
 * @param {string} html - HTML content to parse
 * @param {string} parentId - Chrome bookmark folder ID where items will be imported
 */
export async function importHtml(html, parentId) {
  if (!html || typeof html !== 'string') return;

  // Parse the HTML into a tree structure
  const tree = parseBookmarks(html);

  // Track seen normalized URLs to prevent duplicates within the same import session
  const seenUrls = new Set();
  await seedExistingUrls(seenUrls);

  async function seedExistingUrls(target) {
    if (!chrome?.storage?.local?.get) return;
    try {
      const { urlIndex } = await chrome.storage.local.get('urlIndex');
      if (!urlIndex || typeof urlIndex !== 'object') return;
      for (const [normalized, ids] of Object.entries(urlIndex)) {
        if (!normalized) continue;
        if (Array.isArray(ids)) {
          if (ids.length > 0) target.add(normalized);
        } else if (ids) {
          target.add(normalized);
        }
      }
    } catch (error) {
      console.warn('Failed to hydrate import dedupe cache from urlIndex:', error);
    }
  }

  /**
   * Recursively create bookmarks and folders
   */
  async function createNodes(items, currentParentId) {
    for (const item of items) {
      try {
        if (item.type === 'folder') {
          // Create folder
          const folder = await addBookmark({
            parentId: currentParentId,
            title: item.title || 'Untitled Folder'
          });

          // Recursively create children
          if (item.children && item.children.length > 0) {
            await createNodes(item.children, folder.id);
          }
        } else if (item.type === 'bookmark') {
          const url = (item.url || '').trim();

          // Skip empty URLs
          if (!url) continue;

          // Skip browser-internal URLs (chrome://, edge://, about:, etc.)
          if (isBrowserInternalUrl(url)) {
            continue;
          }

          // Skip duplicates within this import session based on normalized URL
          const normalized = normalizeUrlForKey(url);
          if (normalized && seenUrls.has(normalized)) {
            continue;
          }
          if (normalized) {
            seenUrls.add(normalized);
          }

          // Create bookmark
          await addBookmark({
            parentId: currentParentId,
            title: item.title || url,
            url: url
          });
        }
      } catch (error) {
        console.warn('Failed to import item:', item, error);
        // Continue with next item even if this one fails
      }
    }
  }

  await createNodes(tree, parentId);
}
