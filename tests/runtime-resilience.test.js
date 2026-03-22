const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectAndRun, runTests } = require('../index');

describe('runtime resilience', () => {
  async function withFixture(source, run) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-runtime-'));
    const fixturePath = path.join(tempDir, 'fixture.test.js');
    fs.writeFileSync(fixturePath, source, 'utf8');

    try {
      return await run({ tempDir, fixturePath });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async function withProjectFixture(files, run) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-runtime-project-'));

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

  async function withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  test('reports beforeAll failures as attributed test results', async () => {
    await withFixture(
      `
describe('suite', () => {
  beforeAll(() => {
    throw new Error('beforeAll exploded');
  });

  test('never runs', () => {
    expect(true).toBe(true);
  });
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        expect(result.tests.length).toBe(1);

        const failure = result.tests[0];
        expect(failure.name).toBe('beforeAll');
        expect(failure.fullName).toBe('suite > beforeAll');
        expect(failure.status).toBe('failed');
        expect(failure.error.message).toContain('beforeAll exploded');
      }
    );
  });

  test('reports afterAll failures without dropping normal test results', async () => {
    await withFixture(
      `
describe('suite', () => {
  test('works', () => {
    expect(1 + 1).toBe(2);
  });

  afterAll(() => {
    throw new Error('afterAll exploded');
  });
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        expect(result.tests.length).toBe(2);

        const passedTest = result.tests.find((entry) => entry.name === 'works');
        expect(Boolean(passedTest)).toBe(true);
        expect(passedTest.status).toBe('passed');

        const hookFailure = result.tests.find((entry) => entry.name === 'afterAll');
        expect(Boolean(hookFailure)).toBe(true);
        expect(hookFailure.fullName).toBe('suite > afterAll');
        expect(hookFailure.status).toBe('failed');
        expect(hookFailure.error.message).toContain('afterAll exploded');
      }
    );
  });

  test('does not hang when worker exits before reporting results', async () => {
    await withFixture(
      `
test('worker exits', () => {
  process.exit(1);
});
`,
      async ({ fixturePath }) => {
        const result = await withTimeout(runTests([fixturePath], { maxWorkers: 1 }), 2000);
        expect(result.summary.failed).toBe(1);
        expect(result.summary.total).toBe(1);

        const failure = result.files[0].tests[0];
        expect(failure.name).toBe('worker');
        expect(failure.error.message.includes('Worker exited with code 1')).toBe(true);
      }
    );
  });

  test('sanitizes invalid programmatic worker counts to 1', async () => {
    await withFixture(
      `
test('works', () => {
  expect(true).toBe(true);
});
`,
      async ({ fixturePath }) => {
        const result = await runTests([fixturePath], { maxWorkers: 'abc' });
        expect(result.meta.maxWorkers).toBe(1);
        expect(result.summary.total).toBe(1);
        expect(result.summary.passed).toBe(1);
      }
    );
  });

  test('loads JavaScript ESM files from module-scoped projects', async () => {
    await withProjectFixture(
      {
        'package.json': `${JSON.stringify({ type: 'module' }, null, 2)}\n`,
        'src/math.js': `export function add(a, b) {\n  return a + b;\n}\n`,
        'tests/fixture.test.js': `import { add } from '../src/math.js';\n\ntest('adds in esm mode', () => {\n  expect(add(2, 3)).toBe(5);\n});\n`
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

  test('loads TSX modules through tsconfig path aliases', async () => {
    await withProjectFixture(
      {
        'tsconfig.json': `${JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@app/*': ['src/*']
            },
            jsx: 'react',
            jsxFactory: 'h'
          }
        }, null, 2)}\n`,
        'src/view.tsx': `export function h(tag, props, ...children) {\n  return { tag, props: props || {}, children };\n}\n\nexport function makeBanner(label: string) {\n  return <banner tone="pass">{label}</banner>;\n}\n`,
        'tests/fixture.test.ts': `import { makeBanner } from '@app/view';\n\ntest('renders tsx alias module', () => {\n  const banner = makeBanner('ready');\n  expect(banner.tag).toBe('banner');\n  expect(banner.props.tone).toBe('pass');\n  expect(banner.children[0]).toBe('ready');\n});\n`
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

  test('runs setup files inside the jsdom environment', async () => {
    await withProjectFixture(
      {
        'tests/setup.ts': `beforeEach(() => {\n  document.body.innerHTML = '<main data-ready="yes"></main>';\n});\n`,
        'tests/fixture.test.ts': `test('uses document from setup', () => {\n  const node = document.querySelector('[data-ready="yes"]');\n  expect(typeof window.document.createElement).toBe('function');\n  expect(node.getAttribute('data-ready')).toBe('yes');\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const result = await collectAndRun(resolvePath('tests', 'fixture.test.ts'), {
          cwd: tempDir,
          environment: 'jsdom',
          setupFiles: ['tests/setup.ts']
        });

        expect(result.tests.length).toBe(1);
        expect(result.tests[0].status).toBe('passed');
      }
    );
  });

  test('supports in-process execution caching for local loops', async () => {
    await withProjectFixture(
      {
        'tests/fixture.test.js': `const fs = require('fs');\nconst path = require('path');\nconst counterPath = path.join(__dirname, 'counter.txt');\n\ntest('cached local loop', () => {\n  const current = fs.existsSync(counterPath) ? Number(fs.readFileSync(counterPath, 'utf8')) : 0;\n  fs.writeFileSync(counterPath, String(current + 1), 'utf8');\n  expect(true).toBe(true);\n});\n`
      },
      async ({ tempDir, resolvePath }) => {
        const fixturePath = resolvePath('tests', 'fixture.test.js');
        const counterPath = resolvePath('tests', 'counter.txt');

        let result = await runTests([fixturePath], {
          cwd: tempDir,
          isolation: 'in-process',
          cache: true
        });
        expect(result.summary.failed).toBe(0);
        expect(fs.readFileSync(counterPath, 'utf8')).toBe('1');

        result = await runTests([fixturePath], {
          cwd: tempDir,
          isolation: 'in-process',
          cache: true
        });
        expect(result.summary.failed).toBe(0);
        expect(fs.readFileSync(counterPath, 'utf8')).toBe('1');
      }
    );
  });
});
