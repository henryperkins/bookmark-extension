let creating;

export async function ensureOffscreen(path = 'offscreen.html') {
  let has = false;

  if (typeof chrome.offscreen?.hasDocument === 'function') {
    try {
      has = await chrome.offscreen.hasDocument();
    } catch {
      has = false;
    }
  } else if (typeof chrome.runtime?.getContexts === 'function') {
    try {
      const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
      has = Array.isArray(contexts) && contexts.length > 0;
    } catch {
      has = false;
    }
  }

  if (has) return;

  // If not already creating, create the offscreen document
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['DOM_PARSER'],
      justification: 'Parse HTML for bookmark embeddings and duplicate detection'
    });
  }
  try {
    await creating;
  } finally {
    creating = null;
  }
}
