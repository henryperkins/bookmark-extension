import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safariHtml, edgeHtml } from './fixtures/bookmarkExports.mjs';

let activeCapture = null;

// Minimal stub for the Chrome bookmarks API so importer.js can run under Node.
globalThis.chrome = {
  bookmarks: {
    async create(payload) {
      if (!activeCapture) {
        throw new Error('Bookmark capture buffer not initialised');
      }
      const id = String(activeCapture.length + 1);
      const entry = { ...payload, id };
      activeCapture.push(entry);
      return entry;
    }
  }
};

const { importHtml } = await import('../importer.js');

async function captureImport(html, parentId) {
  activeCapture = [];
  await importHtml(html, parentId);
  const captured = activeCapture;
  activeCapture = null;
  return captured;
}

test('imports Safari and Edge bookmark exports', async () => {
  const safari = await captureImport(safariHtml, 'safariParent');
  assert.ok(safari.length > 100, 'Safari export should yield a sizable bookmark set');
  assert.ok(safari.every(entry => entry.parentId === 'safariParent' || safari.some(f => f.id === entry.parentId)));
  assert.ok(safari.some(entry => entry.url === 'https://console.firebase.google.com/u/0/'));
  assert.ok(safari.some(entry => entry.title.includes('Google User Experience Research')));
  assert.ok(safari.every(entry => typeof entry.title === 'string' && entry.title.trim().length > 0));

  const edge = await captureImport(edgeHtml, 'edgeParent');
  assert.ok(edge.length > 100, 'Edge export should yield a sizable bookmark set');
  assert.ok(edge.every(entry => entry.parentId === 'edgeParent' || edge.some(f => f.id === entry.parentId)));
  assert.ok(edge.some(entry => entry.url?.startsWith('https://webapp4.asu.edu/myasu')));
  assert.ok(edge.some(entry => entry.title.includes('Starbucks Careers 101') || entry.title.includes('Starbucks Careers')));
  assert.ok(edge.every(entry => typeof entry.title === 'string' && entry.title.trim().length > 0));
});

test('preserves folder hierarchy', async () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Work</H3>
  <DL><p>
    <DT><A HREF="https://example.com/work1">Work Item 1</A>
    <DT><H3>Projects</H3>
    <DL><p>
      <DT><A HREF="https://example.com/project1">Project 1</A>
      <DT><A HREF="https://example.com/project2">Project 2</A>
    </DL><p>
  </DL><p>
  <DT><H3>Personal</H3>
  <DL><p>
    <DT><A HREF="https://example.com/personal1">Personal Item</A>
  </DL><p>
</DL><p>`;

  activeCapture = [];
  await importHtml(html, 'root');
  const entries = activeCapture;
  activeCapture = null;

  // Should have folders: Work, Projects (nested), Personal
  const folders = entries.filter(e => !e.url);
  assert.equal(folders.length, 3, 'Should create 3 folders');

  const workFolder = folders.find(f => f.title === 'Work');
  const projectsFolder = folders.find(f => f.title === 'Projects');
  const personalFolder = folders.find(f => f.title === 'Personal');

  assert.ok(workFolder, 'Work folder should exist');
  assert.ok(projectsFolder, 'Projects folder should exist');
  assert.ok(personalFolder, 'Personal folder should exist');

  // Check nesting
  assert.equal(workFolder.parentId, 'root', 'Work should be at root');
  assert.equal(personalFolder.parentId, 'root', 'Personal should be at root');
  assert.equal(projectsFolder.parentId, workFolder.id, 'Projects should be nested under Work');

  // Check bookmarks are in correct folders
  const workItem = entries.find(e => e.url === 'https://example.com/work1');
  const project1 = entries.find(e => e.url === 'https://example.com/project1');
  const project2 = entries.find(e => e.url === 'https://example.com/project2');
  const personalItem = entries.find(e => e.url === 'https://example.com/personal1');

  assert.equal(workItem.parentId, workFolder.id, 'Work item should be in Work folder');
  assert.equal(project1.parentId, projectsFolder.id, 'Project 1 should be in Projects folder');
  assert.equal(project2.parentId, projectsFolder.id, 'Project 2 should be in Projects folder');
  assert.equal(personalItem.parentId, personalFolder.id, 'Personal item should be in Personal folder');
});

test('filters out browser-internal URLs', async () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://example.com/valid">Valid URL</A>
  <DT><A HREF="chrome://settings">Chrome Settings</A>
  <DT><A HREF="edge://settings">Edge Settings</A>
  <DT><A HREF="about:blank">About Blank</A>
  <DT><A HREF="chrome-extension://abc123/page.html">Extension Page</A>
  <DT><A HREF="https://example.com/another-valid">Another Valid</A>
</DL><p>`;

  activeCapture = [];
  await importHtml(html, 'root');
  const entries = activeCapture;
  activeCapture = null;

  // Should only have the two valid URLs
  assert.equal(entries.length, 2, 'Should only import non-browser URLs');
  assert.ok(entries.some(e => e.url === 'https://example.com/valid'), 'Should include first valid URL');
  assert.ok(entries.some(e => e.url === 'https://example.com/another-valid'), 'Should include second valid URL');
  assert.ok(!entries.some(e => e.url?.startsWith('chrome://')), 'Should exclude chrome:// URLs');
  assert.ok(!entries.some(e => e.url?.startsWith('edge://')), 'Should exclude edge:// URLs');
  assert.ok(!entries.some(e => e.url?.startsWith('about:')), 'Should exclude about: URLs');
  assert.ok(!entries.some(e => e.url?.startsWith('chrome-extension://')), 'Should exclude chrome-extension:// URLs');
});

test('prevents duplicate URLs within the same import session', async () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://example.com/page">First Instance</A>
  <DT><A HREF="https://example.com/page">Duplicate</A>
  <DT><A HREF="HTTPS://EXAMPLE.COM/PAGE">Case Different</A>
  <DT><A HREF="https://example.com/page/">Trailing Slash</A>
  <DT><A HREF="https://example.com/other">Different Page</A>
</DL><p>`;

  activeCapture = [];
  await importHtml(html, 'root');
  const entries = activeCapture;
  activeCapture = null;

  // Should only have 2 bookmarks: one normalized version of the page and the other page
  assert.equal(entries.length, 2, 'Should deduplicate normalized URLs');

  const urls = entries.map(e => e.url);
  assert.ok(urls.includes('https://example.com/page') || urls.includes('https://example.com/page/'),
    'Should keep one instance of the duplicate');
  assert.ok(urls.includes('https://example.com/other'), 'Should keep the different page');
});

test('decodes HTML entities correctly', async () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://example.com/?a=1&amp;b=2">Query with Ampersand</A>
  <DT><A HREF="https://example.com/&quot;quoted&quot;">Quoted Path</A>
  <DT><H3>Folder &amp; Subfolder</H3>
  <DL><p>
    <DT><A HREF="https://example.com/nested">Nested &lt;Item&gt;</A>
  </DL><p>
</DL><p>`;

  activeCapture = [];
  await importHtml(html, 'root');
  const entries = activeCapture;
  activeCapture = null;

  const ampersandBookmark = entries.find(e => e.title === 'Query with Ampersand');
  assert.ok(ampersandBookmark, 'Should find ampersand bookmark');
  assert.ok(ampersandBookmark.url.includes('&b=2'), 'URL should have decoded ampersand');

  const quotedBookmark = entries.find(e => e.title === 'Quoted Path');
  assert.ok(quotedBookmark, 'Should find quoted bookmark');

  const folder = entries.find(e => !e.url && e.title.includes('&'));
  assert.ok(folder, 'Should find folder with ampersand');
  assert.equal(folder.title, 'Folder & Subfolder', 'Folder title should have decoded ampersand');

  const nestedBookmark = entries.find(e => e.title?.includes('<Item>'));
  assert.ok(nestedBookmark, 'Should find nested bookmark');
  assert.equal(nestedBookmark.title, 'Nested <Item>', 'Nested item should have decoded angle brackets');
});
