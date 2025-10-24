function escapeHTML(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function walk(nodes, depth = 0) {
  const pad = '    '.repeat(depth);
  let html = '';
  for (const n of nodes) {
    if (n.url) {
      html += `${pad}<DT><A HREF="${escapeHTML(n.url)}" ADD_DATE="${Math.floor(Date.now()/1000)}">${escapeHTML(n.title || n.url)}</A>\n`;
    } else {
      html += `${pad}<DT><H3 ADD_DATE="${Math.floor(Date.now()/1000)}">${escapeHTML(n.title || 'Folder')}</H3>\n`;
      html += `${pad}<DL><p>\n`;
      html += walk(n.children || [], depth + 1);
      html += `${pad}</DL><p>\n`;
    }
  }
  return html;
}

export async function exportBookmarks(rootTitle = "Bookmarks") {
  const tree = await chrome.bookmarks.getTree();
  const body = walk(tree);
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>${escapeHTML(rootTitle)}</TITLE>
<H1>${escapeHTML(rootTitle)}</H1>
<DL><p>
${body}</DL><p>
`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename: `bookmarks-${crypto.randomUUID()}.html`,
    saveAs: true
  });
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
