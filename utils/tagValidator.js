const BLACKLIST = ['misc', 'other', 'general', 'various', 'stuff'];
const CATS = ['Development', 'Design', 'Business', 'Learning', 'Entertainment', 'Reference', 'Tools', 'Personal'];

export function validateTags(tags, category) {
  const clean = (tags || []).filter(t => t && t.length > 2 && !BLACKLIST.includes(t.toLowerCase()));

  if (!CATS.includes(category)) category = 'Reference';
  if (clean.length < 3) clean.push('untagged');

  return { tags: clean.slice(0, 6), category };
}
