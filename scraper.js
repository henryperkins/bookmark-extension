import { ensureOffscreen } from "./utils/offscreen.js";

// Fetch page text via offscreen document with retry to avoid noisy
// "message port closed" errors when the offscreen page isn't ready yet.
export async function getPageText(url) {
  if (!url) return '';
  const MAX_ATTEMPTS = 3;
  try {
    await ensureOffscreen();
  } catch {
    return '';
  }

  return await new Promise((resolve) => {
    const attempt = (n) => {
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'SCRAPE', url }, (res) => {
        const err = chrome.runtime.lastError;
        if (err) {
          // Suppress the console spam by reading lastError.
          if (/port closed/i.test(err.message) && n < MAX_ATTEMPTS - 1) {
            // Exponential-ish backoff.
            setTimeout(() => attempt(n + 1), 150 * (n + 1));
            return;
          }
          return resolve('');
        }
        if (res?.ok) resolve(res.text || '');
        else resolve('');
      });
    };
    attempt(0);
  });
}
