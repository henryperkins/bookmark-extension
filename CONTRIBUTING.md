# Contributing to Edge Bookmark Cleaner

Thank you for considering contributing! This guide will help you get started.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the community

## How to Contribute

### Reporting Bugs

1. **Check existing issues** to avoid duplicates
2. **Use the issue template** (if available)
3. **Include**:
   - Edge version
   - Extension version
   - Steps to reproduce
   - Expected vs actual behavior
   - Console errors (service worker + offscreen + popup)
   - Network errors (if API-related)

### Suggesting Features

1. **Search existing issues** first
2. **Describe the problem** you're trying to solve
3. **Propose a solution** (if you have one)
4. **Explain why** this would benefit other users

### Pull Requests

#### Before You Start

1. **Open an issue** to discuss major changes
2. **Check the roadmap** (CHANGELOG.md → Unreleased)
3. **Claim the issue** (comment that you're working on it)

#### Development Setup

```bash
# Clone the repo
git clone https://github.com/YOUR-USERNAME/edge-bookmark-cleaner.git
cd edge-bookmark-cleaner

# Install dependencies
cd popup
npm install

# Build
npm run build

# Load in Edge
# edge://extensions → Developer mode → Load unpacked
```

#### Making Changes

1. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-123
   ```

2. **Follow code style**:
   - Use ES modules (`import`/`export`)
   - Prefer `async`/`await` over promises
   - Use descriptive variable names
   - Add comments for complex logic
   - Keep functions small and focused

3. **Test thoroughly**:
   - Test in Edge (not just Chrome)
   - Test with small bookmark libraries (10-100)
   - Test with large libraries (1,000+)
   - Test error cases (invalid API key, network failures, etc.)
   - Check console for errors

4. **Update documentation**:
   - Update README.md if adding features
   - Update CHANGELOG.md under `[Unreleased]`
   - Add inline comments for complex code

#### Code Style Guidelines

**JavaScript/TypeScript**:
```javascript
// Good
async function dedupeBookmarks(nodes, threshold = 0.9) {
  const results = await processNodes(nodes);
  return results.filter(r => r.similarity > threshold);
}

// Bad
function dedupeBookmarks(nodes,threshold){
  return processNodes(nodes).then(results=>results.filter(r=>r.similarity>threshold))
}
```

**React Components**:
```tsx
// Good
function ReviewQueue() {
  const [items, setItems] = useState<Duplicate[]>([]);

  useEffect(() => {
    loadPending();
  }, []);

  return <div>{/* ... */}</div>;
}

// Bad
export default () => {
  const [items, setItems] = useState([]);
  // Missing types, unclear component name
}
```

**Comments**:
```javascript
// Good: Explain why, not what
// Use stricter threshold for same-domain duplicates to avoid false positives
const threshold = sameDomain ? 0.95 : 0.90;

// Bad: States the obvious
// Set threshold to 0.95 if same domain, otherwise 0.90
const threshold = sameDomain ? 0.95 : 0.90;
```

#### Submitting

1. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add bulk accept threshold filter"
   # or
   git commit -m "fix: resolve quota exceeded error in device-only mode"
   ```

   Use conventional commits:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation only
   - `style:` - Formatting (no code change)
   - `refactor:` - Code restructuring
   - `test:` - Adding tests
   - `chore:` - Maintenance

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a PR**:
   - Use a clear title
   - Reference related issues (`Fixes #123`)
   - Describe what changed and why
   - Include screenshots for UI changes
   - List testing performed

#### PR Checklist

- [ ] Code follows existing style
- [ ] Tested in Edge (not just Chrome)
- [ ] No console errors
- [ ] Updated README.md (if needed)
- [ ] Updated CHANGELOG.md
- [ ] Inline comments for complex logic
- [ ] No new dependencies (unless justified)
- [ ] Popup builds without errors (`npm run build`)
- [ ] Extension loads without errors

### Edge-Specific Guidelines

- **Don't use Chrome-only APIs** (e.g., `readingList`)
- **Use `minimum_chrome_version`**, not `minimum_edge_version`
- **Test on Windows** if possible (primary Edge platform)
- **Check Edge API support** docs before using new APIs

### Dependency Policy

- **Avoid new dependencies** in service worker (bundle size)
- **Use built-ins** when possible:
  - `crypto.randomUUID()` instead of `uuid`
  - Custom rate limiter instead of `p-limit`
  - Native `fetch()` instead of `axios`
- **Justify new dependencies**:
  - What problem does it solve?
  - Why can't we implement it ourselves?
  - What's the bundle size impact?

### Testing

#### Manual Testing

See [tests/README.md](./tests/README.md) for full checklist.

#### Automated Testing (Future)

Once we add Jest:
```bash
cd tests
npm test
```

### Documentation

- **Code comments**: Explain *why*, not *what*
- **README.md**: User-facing features
- **CHANGELOG.md**: Version history
- **Inline docs**: Complex algorithms

### Areas We Need Help

- [ ] Unit tests (Jest + Chrome extension mocks)
- [ ] Integration tests (Selenium)
- [ ] Performance benchmarks
- [ ] Alternative AI providers (OpenAI, Anthropic, local models)
- [ ] UI improvements (dark mode, accessibility)
- [ ] Localization (i18n)
- [ ] Icon design

## Questions?

- Open an issue
- Check existing docs (README, QUICK_START, tests/README)
- Look at existing code for patterns

## Recognition

Contributors will be:
- Listed in README.md
- Mentioned in release notes
- Given credit in commit history

Thank you for contributing! 🙏
