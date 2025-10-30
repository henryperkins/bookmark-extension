import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        webextensions: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        crypto: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        DOMException: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MessageChannel: 'readonly',
        MessagePort: 'readonly',
        postMessage: 'readonly',
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        indexedDB: 'readonly',
        IDBFactory: 'readonly',
        IDBDatabase: 'readonly',
        IDBTransaction: 'readonly',
        IDBObjectStore: 'readonly',
        IDBCursor: 'readonly',
        IDBIndex: 'readonly',
        IDBRequest: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBVersionChangeEvent: 'readonly',
        FormData: 'readonly',
        DOMParser: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
        Worker: 'readonly',
        SharedWorker: 'readonly',
        ServiceWorker: 'readonly',
        Cache: 'readonly',
        CacheStorage: 'readonly',
        Notification: 'readonly',
        PermissionStatus: 'readonly',
        Permissions: 'readonly',
        GeolocationPosition: 'readonly',
        GeolocationCoordinates: 'readonly',
        Geolocation: 'readonly',
        MediaDevices: 'readonly',
        MediaStream: 'readonly',
        MediaStreamTrack: 'readonly',
        RTCPeerConnection: 'readonly',
        RTCDataChannel: 'readonly',
        RTCIceCandidate: 'readonly',
        RTCSessionDescription: 'readonly',
        DataChannel: 'readonly',
        BroadcastChannel: 'readonly',
        Performance: 'readonly',
        PerformanceEntry: 'readonly',
        PerformanceMark: 'readonly',
        PerformanceMeasure: 'readonly',
        PerformanceNavigationTiming: 'readonly',
        PerformanceResourceTiming: 'readonly',
        PerformanceObserver: 'readonly',
        PerformanceObserverEntryList: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      // Enforce existing codebase conventions
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'never'],

      // Best practices for Chrome extensions
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // ES6+ features that this codebase uses
      'arrow-spacing': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',
      'object-shorthand': 'error',
      'prefer-destructuring': ['error', {
        array: false,
        object: true
      }],

      // Error handling improvements
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',

      // Code quality
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-var': 'error',
      'prefer-const': 'error',

      // Style consistency
      'space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'eol-last': 'error',
      'no-trailing-spaces': 'error',

      // Chrome extension specific patterns
      'no-empty': ['error', { allowEmptyCatch: true }],
      'require-await': 'off', // Allow async functions without await for Chrome APIs
      'no-promise-executor-return': 'error'
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './popup/tsconfig.json'
      },
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        webextensions: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        crypto: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        DOMException: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MessageChannel: 'readonly',
        MessagePort: 'readonly',
        postMessage: 'readonly',
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        indexedDB: 'readonly',
        FormData: 'readonly',
        DOMParser: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        URLSearchParams: 'readonly',
        performance: 'readonly',
        Performance: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // Keep consistency with JavaScript rules
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'indent': 'off', // Let TypeScript handle
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-unused-vars': 'off' // Use TypeScript version
    }
  },
  {
    files: ['popup/**/*'],
    languageOptions: {
      globals: {
        React: 'readonly',
        JSX: 'readonly'
      }
    }
  },
  {
    files: ['tests/**/*.test.*', '**/*.spec.*', '**/__tests__/**/*'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    },
    rules: {
      'no-console': 'off' // Allow console in tests
    }
  },
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      'coverage/**',
      '*.min.js',
      'popup/dist/**',
      'popup/vite.config.ts',
      'shared/**',
      'tests/e2e/**'
    ]
  }
];
