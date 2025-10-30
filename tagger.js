import { validateTags } from './utils/tagValidator.js';

export async function tagNodes(nodes, openai, opts = {}) {
  if (!nodes.length) return [];
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const BATCH = 50;
  const out = [];

  if (onProgress) {
    try { onProgress(0, nodes.length); } catch {}
  }

  for (let i = 0; i < nodes.length; i += BATCH) {
    const slice = nodes.slice(i, i + BATCH);
    const messages = [
      { role: 'system', content: 'You are BookmarkTagger. For each line TITLE | URL return a JSON array matching input order: {tags:[3-6 strings], category:string}.' },
      { role: 'user', content: slice.map(b => `${b.title || ''} | ${b.url || ''}`).join('\n') }
    ];
    try {
      const res = await openai.chat(messages);
      let parsed = [];
      try {
        parsed = JSON.parse(res.choices?.[0]?.message?.content || '[]');
        if (!Array.isArray(parsed)) throw new Error('Expected array');
      } catch {
        parsed = slice.map(() => ({ tags: ['untagged'], category: 'Reference' }));
      }
      parsed.forEach((p, idx) => {
        const { tags, category } = validateTags(p?.tags || [], p?.category || 'Reference');
        out.push({ ...slice[idx], tags, category });
      });
      if (onProgress) {
        try { onProgress(out.length, nodes.length); } catch {}
      }
    } catch (e) {
      console.error(`Tagging batch ${i} failed:`, e);
      slice.forEach(item => {
        out.push({ ...item, tags: ['untagged'], category: 'Reference' });
      });
      if (onProgress) {
        try { onProgress(out.length, nodes.length); } catch {}
      }
    }
  }

  if (onProgress) {
    try { onProgress(out.length, nodes.length); } catch {}
  }

  return out;
}
