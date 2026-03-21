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
});
