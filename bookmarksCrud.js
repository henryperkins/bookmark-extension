export const addBookmark = (payload) => chrome.bookmarks.create(payload);
export const editBookmark = (id, changes) => chrome.bookmarks.update(id, changes);
export const deleteBookmark = (id) => chrome.bookmarks.removeTree(id);
