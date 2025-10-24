export async function suggestFolders(bookmark, openai) {
  const roots = await chrome.bookmarks.getTree();
  const folders = [];

  const walk = (n) => {
    if (!n.url && n.title) folders.push(n.title);
    (n.children || []).forEach(walk);
  };

  roots.forEach(walk);

  if (folders.length === 0) return '';

  const prompt = `Given this bookmark:
Title: ${bookmark.title}
URL: ${bookmark.url}
Tags: ${bookmark.tags?.join(', ') || ''}
Suggest the best folder from: ${folders.join(', ')}
Respond with just the folder name.`;

  try {
    const res = await openai.chat([
      { role: 'system', content: 'You are a bookmark organizer.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.0 });
    return res.choices?.[0]?.message?.content?.trim() || '';
  } catch (e) {
    console.warn('Folder suggestion failed:', e);
    return '';
  }
}
