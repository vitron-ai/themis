const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectAndRun } = require('../index');

describe('test utilities', () => {
  async function withProjectFixture(files, run) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-utils-'));

    for (const [relativePath, source] of Object.entries(files)) {
      const targetPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, source, 'utf8');
    }

    try {
      return await run({
        tempDir,
        resolvePath: (...parts) => path.join(tempDir, ...parts)
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  test('tracks fn calls and restores spies', async () => {
    await withProjectFixture(
      {
        'tests/fixture.test.js': `test('mock primitives', () => {\n  const worker = fn((value) => value + 1);\n  const greeter = {\n    speak(name) {\n      return 'hello ' + name;\n    }\n  };\n  const spy = spyOn(greeter, 'speak');\n\n  expect(worker(41)).toBe(42);\n  expect(greeter.speak('themis')).toBe('hello themis');\n  expect(worker).toHaveBeenCalledTimes(1);\n  expect(worker).toHaveBeenCalledWith(41);\n  expect(spy).toHaveBeenCalledWith('themis');\n\n  restoreAllMocks();\n  expect(greeter.speak('agent')).toBe('hello agent');\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const result = await collectAndRun(resolvePath('tests', 'fixture.test.js'), {
          cwd: tempDir
        });

        expect(result.tests.length).toBe(1);
        expect(result.tests[0].status).toBe('passed');
      }
    );
  });

  test('supports explicit module mocks for requires that happen after registration', async () => {
    await withProjectFixture(
      {
        'src/dependency.ts': `export function fetchName() {\n  return 'real';\n}\n`,
        'tests/fixture.test.ts': `mock('../src/dependency.ts', () => ({\n  fetchName: fn(() => 'mocked')\n}));\n\nconst { fetchName } = require('../src/dependency.ts');\n\ntest('uses module mock', () => {\n  expect(fetchName()).toBe('mocked');\n  expect(fetchName).toHaveBeenCalledTimes(1);\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const result = await collectAndRun(resolvePath('tests', 'fixture.test.ts'), {
          cwd: tempDir
        });

        expect(result.tests.length).toBe(1);
        expect(result.tests[0].status).toBe('passed');
      }
    );
  });

  test('supports direct object contract assertions without snapshot files', async () => {
    await withProjectFixture(
      {
        'tests/fixture.test.js': `test('matches direct contract', () => {\n  const result = {\n    status: 'ok',\n    count: 2,\n    meta: {\n      team: 'themis',\n      stable: true\n    }\n  };\n\n  expect(result).toMatchObject({\n    status: 'ok',\n    meta: {\n      team: 'themis'\n    }\n  });\n  expect(result.count).toBe(2);\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const fixturePath = resolvePath('tests', 'fixture.test.js');
        const firstRun = await collectAndRun(fixturePath, { cwd: tempDir });
        expect(firstRun.tests[0].status).toBe('passed');
        expect(fs.existsSync(resolvePath('tests', '__snapshots__'))).toBe(false);
      }
    );
  });

  test('captures contract artifacts and fails on drift until explicitly updated', async () => {
    await withProjectFixture(
      {
        'tests/fixture.test.js': `test('captures artifact contract', () => {\n  const state = {\n    status: process.env.THEMIS_CONTRACT_STATE || 'idle',\n    count: 2,\n    meta: { team: 'themis' }\n  };\n\n  captureContract('state contract', state);\n  expect(state.count).toBe(2);\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const fixturePath = resolvePath('tests', 'fixture.test.js');
        let result = await collectAndRun(fixturePath, { cwd: tempDir });
        expect(result.tests[0].status).toBe('passed');
        expect(result.contracts[0].status).toBe('created');
        expect(fs.existsSync(resolvePath('.themis', 'contracts'))).toBe(true);

        process.env.THEMIS_CONTRACT_STATE = 'busy';
        result = await collectAndRun(fixturePath, { cwd: tempDir });
        expect(result.tests[0].status).toBe('failed');
        expect(result.contracts[0].status).toBe('drifted');

        result = await collectAndRun(fixturePath, { cwd: tempDir, updateContracts: true });
        expect(result.tests[0].status).toBe('passed');
        expect(result.contracts[0].status).toBe('updated');
        delete process.env.THEMIS_CONTRACT_STATE;
      }
    );
  });

  test('renders react-like elements and supports screen queries plus events in jsdom', async () => {
    await withProjectFixture(
      {
        'tsconfig.json': `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "CommonJS",\n    "jsx": "react-jsx"\n  }\n}\n`,
        'node_modules/react/index.js': `const Fragment = Symbol.for('react.fragment');\nmodule.exports = { Fragment };\n`,
        'node_modules/react/jsx-runtime.js': `const Fragment = Symbol.for('react.fragment');\nfunction jsx(type, props, key) { return { $$typeof: 'react.test.element', type, key: key || null, props: props || {} }; }\nconst jsxs = jsx;\nmodule.exports = { Fragment, jsx, jsxs };\n`,
        'tests/fixture.test.tsx': `const state = { count: 0 };\n\nfunction Counter() {\n  return <button onClick={() => { state.count += 1; }}>{'Count ' + state.count}</button>;\n}\n\ntest('dom primitives', async () => {\n  const view = render(<Counter />);\n  const button = screen.getByRole('button', { name: 'Count 0' });\n  expect(button).toBeInTheDocument();\n  expect(button).toHaveTextContent('Count 0');\n\n  fireEvent.click(button);\n  view.rerender(<Counter />);\n\n  await waitFor(() => {\n    expect(screen.getByText('Count 1')).toBeInTheDocument();\n  });\n\n  cleanup();\n  expect(screen.queryByText('Count 1')).toBe(null);\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const result = await collectAndRun(resolvePath('tests', 'fixture.test.tsx'), {
          cwd: tempDir,
          environment: 'jsdom',
          tsconfigPath: 'tsconfig.json'
        });

        expect(result.tests).toHaveLength(1);
        expect(result.tests[0].status).toBe('passed');
      }
    );
  });

  test('supports incremental Jest and Vitest migration imports at runtime', async () => {
    await withProjectFixture(
      {
        'tsconfig.json': `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "CommonJS",\n    "jsx": "react-jsx"\n  }\n}\n`,
        'node_modules/react/index.js': `const Fragment = Symbol.for('react.fragment');\nmodule.exports = { Fragment };\n`,
        'node_modules/react/jsx-runtime.js': `const Fragment = Symbol.for('react.fragment');\nfunction jsx(type, props, key) { return { $$typeof: 'react.test.element', type, key: key || null, props: props || {} }; }\nconst jsxs = jsx;\nmodule.exports = { Fragment, jsx, jsxs };\n`,
        'tests/fixture.test.tsx': `import { describe, test, expect, jest } from '@jest/globals';\nimport { vi } from 'vitest';\nimport { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';\n\nconst state = { count: 0 };\n\nfunction Counter() {\n  return <button onClick={() => { state.count += 1; }}>{'Count ' + state.count}</button>;\n}\n\ndescribe('compat imports', () => {\n  test('runs through Themis compatibility shims', async () => {\n    const clickSpy = jest.fn();\n    const toggleSpy = vi.fn();\n    const view = render(<Counter />);\n    const button = screen.getByRole('button', { name: 'Count 0' });\n\n    fireEvent.click(button);\n    clickSpy('clicked');\n    toggleSpy('toggled');\n    view.rerender(<Counter />);\n\n    await waitFor(() => {\n      expect(screen.getByText('Count 1')).toBeInTheDocument();\n    });\n\n    expect(clickSpy).toHaveBeenCalledWith('clicked');\n    expect(toggleSpy).toHaveBeenCalledWith('toggled');\n    cleanup();\n  });\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const result = await collectAndRun(resolvePath('tests', 'fixture.test.tsx'), {
          cwd: tempDir,
          environment: 'jsdom',
          tsconfigPath: 'tsconfig.json'
        });

        expect(result.tests).toHaveLength(1);
        expect(result.tests[0].status).toBe('passed');
      }
    );
  });

  test('supports label queries, input events, and attribute matchers', async () => {
    await withProjectFixture(
      {
        'tests/fixture.test.js': `test('form primitives', () => {\n  const view = render([\n    (() => {\n      const label = document.createElement('label');\n      label.textContent = 'Email';\n      label.setAttribute('for', 'email');\n      return label;\n    })(),\n    (() => {\n      const input = document.createElement('input');\n      input.id = 'email';\n      input.type = 'text';\n      input.setAttribute('data-state', 'idle');\n      input.addEventListener('input', () => {\n        input.setAttribute('data-state', 'dirty');\n      });\n      return input;\n    })()\n  ]);\n\n  const input = screen.getByLabelText('Email');\n  fireEvent.input(input, { target: { value: 'ada@themis.test' } });\n\n  expect(input.value).toBe('ada@themis.test');\n  expect(input).toHaveAttribute('data-state', 'dirty');\n  expect(screen.getByRole('textbox')).toBe(input);\n  view.unmount();\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const result = await collectAndRun(resolvePath('tests', 'fixture.test.js'), {
          cwd: tempDir,
          environment: 'jsdom'
        });

        expect(result.tests[0].status).toBe('passed');
      }
    );
  });

  test('supports fake timers and deterministic async advancement', async () => {
    await withProjectFixture(
      {
        'tests/fixture.test.js': `test('fake timers', async () => {\n  useFakeTimers();\n  const events = [];\n  setTimeout(() => {\n    events.push('timeout');\n  }, 20);\n  setTimeout(() => {\n    events.push('later');\n  }, 40);\n\n  advanceTimersByTime(20);\n  expect(events).toEqual(['timeout']);\n\n  advanceTimersByTime(20);\n  expect(events).toEqual(['timeout', 'later']);\n\n  useRealTimers();\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const result = await collectAndRun(resolvePath('tests', 'fixture.test.js'), {
          cwd: tempDir
        });

        expect(result.tests[0].status).toBe('passed');
      }
    );
  });

  test('supports flushing microtasks and mocked fetch responses in jsdom', async () => {
    await withProjectFixture(
      {
        'tests/fixture.test.js': `test('fetch primitives', async () => {\n  const fetchMock = mockFetch({ json: { ok: true, team: 'themis' }, status: 201 });\n  const state = { label: 'idle' };\n\n  async function load() {\n    state.label = 'loading';\n    const response = await fetch('https://themis.test/api/status');\n    const payload = await response.json();\n    state.label = payload.team;\n  }\n\n  const pending = load();\n  expect(state.label).toBe('loading');\n  await flushMicrotasks();\n  await pending;\n\n  expect(state.label).toBe('themis');\n  expect(fetchMock).toHaveBeenCalledWith('https://themis.test/api/status');\n  resetFetchMocks();\n  expect(fetchMock.mock.calls).toHaveLength(0);\n  restoreFetch();\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const result = await collectAndRun(resolvePath('tests', 'fixture.test.js'), {
          cwd: tempDir,
          environment: 'jsdom'
        });

        expect(result.tests[0].status).toBe('passed');
      }
    );
  });
});
