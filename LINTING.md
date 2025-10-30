# Linting Guide

This document explains the linting configuration and best practices for the Chrome extension codebase.

## ESLint Configuration

The project uses **ESLint v9** with a modern flat configuration (`eslint.config.js`). For ESLint v8 compatibility, a legacy configuration file (`.eslintrc.legacy.js`) is also provided.

### Setup

```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Use legacy config (ESLint v8)
npm run lint:legacy
```

## Code Style Standards

Based on analysis of the existing codebase, ESLint enforces these conventions:

### JavaScript/TypeScript Standards
- **Quotes**: Single quotes (`'`) with escape allowance
- **Semicolons**: Always required
- **Indentation**: 2 spaces (no tabs)
- **Trailing commas**: Not allowed
- **Line endings**: Files must end with newline

### ES6+ Features
- **Arrow functions**: Preferred for callbacks
- **Template literals**: Preferred over string concatenation
- **Destructuring**: Preferred for object properties
- **Optional chaining**: Encouraged for safe property access
- **Nullish coalescing**: Encouraged over logical OR for safety

### Import/Export
- **ES modules**: Required (import/export syntax)
- **File extensions**: Required (`.js`, `.ts`, etc.)
- **Named exports**: Preferred, default exports for components/classes

## Configuration Files

### `eslint.config.js` (ESLint v9)
- Modern flat configuration
- TypeScript support via `@typescript-eslint`
- Chrome extension globals configured
- Separate rules for JS/TS files

### `.eslintrc.legacy.js` (ESLint v8)
- Legacy configuration format
- Compatible with older ESLint versions
- Same rules as modern config

## Browser/Chrome Extension Support

The configuration includes comprehensive globals for:
- **Chrome APIs**: `chrome`, `browser`, `webextensions`
- **Web APIs**: `fetch`, `URL`, `Blob`, `DOMParser`, etc.
- **Timers**: `setTimeout`, `setInterval`, etc.
- **Storage**: `localStorage`, `sessionStorage`, `indexedDB`
- **Browser APIs**: `window`, `document`, `navigator`, etc.
- **Node.js**: `process`, `Buffer`, etc. (for build tools)
- **Testing**: `describe`, `it`, `test`, `expect`, etc.

## Ignored Files

ESLint ignores these files and directories:
- `node_modules/`
- `build/`, `dist/`, `coverage/`
- `popup/dist/`
- `popup/vite.config.ts`
- `shared/` (shared type definitions)
- `tests/e2e/` (end-to-end tests)
- `*.min.js` (minified files)

## Common Issues & Solutions

### Console Statements
- `console.log` is **warned** (not error)
- `console.warn` and `console.error` are **allowed**
- Consider using the extension's debug logging instead

### Unused Variables
- Variables prefixed with `_` are allowed (e.g., `_unused`)
- Helps with destructuring and function parameters

### Error Handling
- Empty catch blocks are allowed (Chrome extension pattern)
- Promise executor return values are checked

### TypeScript Specific
- Strict typing encouraged but `any` allowed with warnings
- Nullish coalescing preferred over logical OR
- Unused TypeScript rules properly configured

## Chrome Extension Specific Rules

### Security
- `eval()` and `new Function()` are disallowed
- Script URLs are blocked
- Chrome API validation

### Performance
- Rate limiting patterns validated
- Memory leak prevention
- Async/await patterns encouraged

### Browser Compatibility
- Chrome Extension Manifest V3 APIs supported
- Service worker patterns validated
- Message passing patterns checked

## Development Workflow

### 1. Pre-commit Checks
```bash
npm run lint
npm run lint:fix  # Auto-fix where possible
```

### 2. IDE Integration
Most editors support ESLint integration:
- **VS Code**: ESLint extension
- **WebStorm**: Built-in ESLint support
- **Vim/Neovim**: ALE, coc.nvim

### 3. CI/CD Integration
Add to your CI pipeline:
```yaml
- name: Run ESLint
  run: npm run lint
```

## Adding New Rules

To add new ESLint rules:

1. Update `eslint.config.js`
2. Test with `npm run lint`
3. Update this documentation if needed

### Example: Adding a new rule
```javascript
// In eslint.config.js
rules: {
  'no-magic-numbers': ['warn', { ignore: [0, 1, -1] }],
  'max-len': ['error', { code: 120 }]
}
```

## Troubleshooting

### "Could not find plugin" Error
```bash
npm install --save-dev @typescript-eslint/eslint-plugin
```

### TypeScript Configuration Issues
- Ensure `popup/tsconfig.json` includes all TS files
- Files outside tsconfig scope are ignored automatically

### Legacy ESLint Version
```bash
# Use v8 compatible config
npm run lint:legacy
```

## Migration from v8 to v9

The project supports both ESLint v8 and v9:
- **v9**: Uses `eslint.config.js` (recommended)
- **v8**: Uses `.eslintrc.legacy.js` (compatibility)

To migrate from v8 to v9:
1. Update ESLint to v9+
2. Use `eslint.config.js` instead of legacy config
3. Update any custom plugins/configs

## Benefits

This ESLint configuration provides:
- ✅ **Consistent code style** across the codebase
- ✅ **Chrome extension compatibility**
- ✅ **Modern JavaScript/TypeScript support**
- ✅ **Security best practices**
- ✅ **Performance optimization**
- ✅ **Developer productivity**

## References

- [ESLint Documentation](https://eslint.org/)
- [TypeScript ESLint](https://typescript-eslint.io/)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)