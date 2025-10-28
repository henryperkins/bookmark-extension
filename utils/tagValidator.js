const BLACKLIST = ['misc', 'other', 'general', 'various', 'stuff'];
const CATS = ['Development', 'Design', 'Business', 'Learning', 'Entertainment', 'Reference', 'Tools', 'Personal'];
const FALLBACK_TAGS = ['untagged', 'bookmark', 'reference'];
const MIN_TAGS = 3;

export function validateTags(tags, category) {
  const clean = [];
  for (const tag of tags || []) {
    if (!tag || tag.length <= 2) continue;
    if (BLACKLIST.includes(tag.toLowerCase())) continue;
    if (!clean.includes(tag)) clean.push(tag);
  }

  if (!CATS.includes(category)) category = 'Reference';

  for (const fallback of FALLBACK_TAGS) {
    if (clean.length >= MIN_TAGS) break;
    if (!clean.includes(fallback)) clean.push(fallback);
  }

  return { tags: clean.slice(0, 6), category };
}
