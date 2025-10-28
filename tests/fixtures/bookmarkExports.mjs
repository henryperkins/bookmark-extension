const DOCTYPE = '<!DOCTYPE NETSCAPE-Bookmark-file-1>';

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const createBookmarkSeries = (prefix, count, baseUrl) => {
  const slug = slugify(prefix) || 'item';
  return Array.from({ length: count }, (_, index) => ({
    title: `${prefix} ${index + 1}`,
    url: `${baseUrl}/${slug}-${index + 1}`
  }));
};

const renderBookmarks = (bookmarks, indent) => bookmarks
  .map(({ title, url }) => `${indent}<DT><A HREF="${escapeHtml(url)}">${escapeHtml(title)}</A>`)
  .join('\n');

const renderFolder = (folder, indent = '  ') => {
  const lines = [
    `${indent}<DT><H3>${escapeHtml(folder.title)}</H3>`,
    `${indent}<DL><p>`
  ];

  if (folder.bookmarks && folder.bookmarks.length) {
    lines.push(renderBookmarks(folder.bookmarks, `${indent}  `));
  }

  if (folder.folders && folder.folders.length) {
    for (const child of folder.folders) {
      lines.push(renderFolder(child, `${indent}  `));
    }
  }

  lines.push(`${indent}</DL><p>`);
  return lines.join('\n');
};

const createNetscapeExport = ({ rootFolders = [], rootBookmarks = [] }) => {
  const lines = [DOCTYPE, '<DL><p>'];

  if (rootBookmarks.length) {
    lines.push(renderBookmarks(rootBookmarks, '  '));
  }

  for (const folder of rootFolders) {
    lines.push(renderFolder(folder));
  }

  lines.push('</DL><p>');
  return lines.join('\n');
};

const safariFolders = [
  {
    title: 'Research',
    bookmarks: [
      { title: 'Firebase Console', url: 'https://console.firebase.google.com/u/0/' },
      { title: 'Google User Experience Research', url: 'https://research.google.com/userexperience/' }
    ],
    folders: [
      {
        title: 'Conference Notes',
        bookmarks: createBookmarkSeries('WWDC Session', 40, 'https://safari.example.com/wwdc'),
        folders: []
      },
      {
        title: 'Accessibility',
        bookmarks: createBookmarkSeries('Accessibility Resource', 32, 'https://safari.example.com/a11y'),
        folders: []
      }
    ]
  },
  {
    title: 'Personal',
    bookmarks: createBookmarkSeries('Recipe', 28, 'https://safari.example.com/recipe'),
    folders: [
      {
        title: 'Travel Plans',
        bookmarks: createBookmarkSeries('Destination', 20, 'https://safari.example.com/travel'),
        folders: []
      }
    ]
  }
];

const safariRootBookmarks = [
  ...createBookmarkSeries('Reading List', 6, 'https://safari.example.com/reading')
];

export const safariHtml = createNetscapeExport({
  rootFolders: safariFolders,
  rootBookmarks: safariRootBookmarks
});

const edgeFolders = [
  {
    title: 'University',
    bookmarks: [
      { title: 'ASU My ASU Portal', url: 'https://webapp4.asu.edu/myasu' }
    ],
    folders: [
      {
        title: 'Study Guides',
        bookmarks: createBookmarkSeries('Course Module', 42, 'https://edge.example.edu/modules'),
        folders: []
      },
      {
        title: 'Advising',
        bookmarks: createBookmarkSeries('Advising Resource', 24, 'https://edge.example.edu/advising'),
        folders: []
      }
    ]
  },
  {
    title: 'Career',
    bookmarks: [
      { title: 'Starbucks Careers 101', url: 'https://careers.starbucks.com/101' },
      ...createBookmarkSeries('Career Resource', 38, 'https://edge.example.com/career')
    ],
    folders: [
      {
        title: 'Interview Prep',
        bookmarks: createBookmarkSeries('Interview Question', 30, 'https://edge.example.com/interview'),
        folders: []
      }
    ]
  }
];

const edgeRootBookmarks = [
  ...createBookmarkSeries('Pinned Article', 8, 'https://edge.example.com/pinned')
];

export const edgeHtml = createNetscapeExport({
  rootFolders: edgeFolders,
  rootBookmarks: edgeRootBookmarks
});

export const countBookmarks = (html) => {
  const matches = html.match(/<DT><A\s+HREF=/g);
  return matches ? matches.length : 0;
};

