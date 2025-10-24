const TAG_SUFFIX_PATTERN = /\s--\s(?:#[^\s#]+)(?:\s#[^\s#]+)*$/;

export async function writeTags(taggedKeep, dupes = []) {
  for (const item of taggedKeep) {
    const suffix = item.tags?.length ? ` -- ${item.tags.map(t => `#${t}`).join(' ')}` : '';
    const baseTitle = (item.title || '').replace(TAG_SUFFIX_PATTERN, '').trimEnd();
    const newTitle = suffix ? `${baseTitle}${suffix}` : baseTitle;

    try {
      await chrome.bookmarks.update(item.id, { title: newTitle });
    } catch (e) {
      console.warn(`Failed to update bookmark ${item.id}:`, e);
    }
  }

  for (const d of dupes) {
    if (!d?.url) continue;
    try {
      await chrome.bookmarks.removeTree(d.id);
    } catch (e) {
      console.warn(`Failed to remove duplicate ${d.id}:`, e);
    }
  }
}
