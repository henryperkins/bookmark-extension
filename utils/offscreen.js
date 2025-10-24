let creating;

export async function ensureOffscreen(path = 'offscreen.html') {
  // Check if offscreen document already exists using hasDocument API (simpler than getContexts)
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;

  // If not already creating, create the offscreen document
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['DOM_PARSER'],
      justification: 'Parse HTML for bookmark embeddings and duplicate detection'
    });
  }

  await creating;
  creating = null;
}
