// Legacy ESLint configuration for ESLint v8 compatibility
// Use this file if you need to run ESLint v8 instead of v9

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    webextensions: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
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
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
      ],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './popup/tsconfig.json'
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
        '@typescript-eslint/indent': ['error', 2],

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
      env: {
        browser: true,
        es2022: true,
        webextensions: true
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly'
      },
      rules: {
        // React specific rules
        'react/jsx-uses-react': 'off', // Not needed for React 17+
        'react/react-in-jsx-scope': 'off', // Not needed for React 17+
        'react/jsx-uses-vars': 'error'
      }
    },
    {
      files: ['tests/**/*.test.*', '**/*.spec.*', '**/__tests__/**/*'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off' // Allow console in tests
      }
    }
  ],
  ignorePatterns: [
    'node_modules/',
    'build/',
    'dist/',
    'coverage/',
    '*.min.js',
    'popup/dist/'
  ]
};
