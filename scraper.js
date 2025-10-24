import { ensureOffscreen } from "./utils/offscreen.js";

export async function getPageText(url) {
  try {
    await ensureOffscreen();
    return await new Promise((resolve) => {
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'SCRAPE', url }, (res) => {
        if (res?.ok) resolve(res.text || '');
        else resolve('');
      });
    });
  } catch {
    return '';
  }
}
