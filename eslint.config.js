const globals = require('globals');

const themisTestGlobals = {
  describe: 'readonly',
  test: 'readonly',
  it: 'readonly',
  intent: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  captureContract: 'readonly',
  render: 'readonly',
  screen: 'readonly',
  fireEvent: 'readonly',
  waitFor: 'readonly',
  cleanup: 'readonly',
  useFakeTimers: 'readonly',
  advanceTimersByTime: 'readonly',
  runAllTimers: 'readonly',
  useRealTimers: 'readonly',
  flushMicrotasks: 'readonly',
  mockFetch: 'readonly',
  restoreFetch: 'readonly',
  resetFetchMocks: 'readonly',
  fn: 'readonly',
  spyOn: 'readonly',
  mock: 'readonly',
  unmock: 'readonly',
  clearAllMocks: 'readonly',
  resetAllMocks: 'readonly',
  restoreAllMocks: 'readonly'
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.themis/**',
      '.themis-bench/**',
      'src/assets/**',
      'tests/generated/**',
      'tests/fixtures/**'
    ]
  },
  {
    files: [
      'bin/**/*.js',
      'src/**/*.js',
      'scripts/**/*.js',
      'tests/**/*.js',
      'packages/**/*.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }]
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: themisTestGlobals
    }
  },
  {
    files: ['src/expect.js', 'src/test-utils.js'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  }
];
