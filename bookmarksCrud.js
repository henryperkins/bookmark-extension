export const addBookmark = (payload) => chrome.bookmarks.create(payload);
export const editBookmark = (id, changes) => chrome.bookmarks.update(id, changes);
export async function deleteBookmark(id) {
	const nodes = await chrome.bookmarks.get(id);
	const node = Array.isArray(nodes) ? nodes[0] : undefined;
	if (!node) return;

	if (Array.isArray(node.children) && node.children.length > 0) {
		return chrome.bookmarks.removeTree(id);
	}

	return chrome.bookmarks.remove(id);
}
