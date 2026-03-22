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

  test('writes and updates snapshot files', async () => {
    await withProjectFixture(
      {
        'tests/fixture.test.js': `test('stores snapshot', () => {\n  expect({ status: 'ok', count: 2 }).toMatchSnapshot();\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const fixturePath = resolvePath('tests', 'fixture.test.js');
        const snapshotPath = resolvePath('tests', '__snapshots__', 'fixture.test.js.snapshots.json');

        const firstRun = await collectAndRun(fixturePath, { cwd: tempDir });
        expect(firstRun.tests[0].status).toBe('passed');
        expect(fs.existsSync(snapshotPath)).toBe(true);

        const firstSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        expect(Object.keys(firstSnapshot)).toHaveLength(1);

        const secondRun = await collectAndRun(fixturePath, { cwd: tempDir });
        expect(secondRun.tests[0].status).toBe('passed');

        fs.writeFileSync(
          fixturePath,
          `test('stores snapshot', () => {\n  expect({ status: 'changed', count: 2 }).toMatchSnapshot();\n});\n`,
          'utf8'
        );

        const mismatchRun = await collectAndRun(fixturePath, { cwd: tempDir });
        expect(mismatchRun.tests[0].status).toBe('failed');
        expect(mismatchRun.tests[0].error.message).toContain('Snapshot mismatch');

        const updatedRun = await collectAndRun(fixturePath, {
          cwd: tempDir,
          updateSnapshots: true
        });
        expect(updatedRun.tests[0].status).toBe('passed');

        const updatedSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        const snapshotValue = updatedSnapshot['stores snapshot'];
        expect(snapshotValue).toContain('changed');
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
