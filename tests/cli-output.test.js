const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'themis.js');

describe('cli output', () => {
  async function withFixtureProject(run, fixtureSource) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-cli-'));
    const testsDir = path.join(tempDir, 'tests');
    fs.mkdirSync(testsDir, { recursive: true });

    const fixturePath = path.join(testsDir, 'sample.test.js');
    const source = fixtureSource || `describe('cli fixture', () => {\n  test('works', () => {\n    expect(1 + 1).toBe(2);\n  });\n});\n`;
    fs.writeFileSync(
      fixturePath,
      source,
      'utf8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'themis.config.json'),
      `${JSON.stringify({
        testDir: 'tests',
        testRegex: '\\.(test|spec)\\.js$',
        maxWorkers: 1,
        reporter: 'next'
      }, null, 2)}\n`,
      'utf8'
    );

    try {
      return await run({ tempDir, fixturePath });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async function withProjectFiles(run, files, config) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-cli-modern-'));

    for (const [relativePath, source] of Object.entries(files)) {
      const targetPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, source, 'utf8');
    }

    fs.writeFileSync(
      path.join(tempDir, 'themis.config.json'),
      `${JSON.stringify({
        testDir: 'tests',
        testRegex: '\\.(test|spec)\\.(ts|tsx)$',
        maxWorkers: 1,
        reporter: 'json',
        environment: 'jsdom',
        setupFiles: ['tests/setup.ts'],
        tsconfigPath: 'tsconfig.json',
        ...config
      }, null, 2)}\n`,
      'utf8'
    );

    try {
      return await run({ tempDir });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  function runCli(tempDir, args) {
    return runCliCommand(tempDir, 'test', args);
  }

  function runCliCommand(tempDir, command, args) {
    const result = spawnSync(process.execPath, [CLI_PATH, command, ...args], {
      cwd: tempDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        NO_COLOR: '1'
      }
    });

    return {
      status: result.status,
      output: `${result.stdout || ''}${result.stderr || ''}`
    };
  }

  function normalizeOutput(raw, fixturePath) {
    const fixtureDir = path.dirname(fixturePath);

    let output = String(raw || '').replace(/\r\n/g, '\n');
    output = output.replace(/THEMIS v[^\n]+/g, 'THEMIS v<VERSION>');
    output = replacePathVariants(output, fixturePath, '<FIXTURE_TEST_FILE>');
    output = replacePathVariants(output, fixtureDir, '<FIXTURE_DIR>');
    output = output.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<ISO_TIMESTAMP>');
    output = output.replace(/workers \d+/g, 'workers <WORKERS>');
    output = output.replace(/\b\d+(?:\.\d+)?ms\b/g, '<MS>');

    return output;
  }

  function replacePathVariants(input, targetPath, token) {
    let output = input;
    const variants = getPathVariants(targetPath);
    for (const variant of variants) {
      output = output.replace(new RegExp(escapeRegExp(variant), 'g'), token);
    }
    return output;
  }

  function getPathVariants(targetPath) {
    const variants = new Set([targetPath]);
    try {
      variants.add(fs.realpathSync(targetPath));
    } catch {
      // Ignore non-resolvable paths, the original target is still used.
    }

    for (const variant of [...variants]) {
      if (variant.startsWith('/var/')) {
        variants.add(`/private${variant}`);
      }
      if (variant.startsWith('/private/var/')) {
        variants.add(variant.slice('/private'.length));
      }
    }

    return [...variants].sort((a, b) => b.length - a.length);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function expectIncludesAll(output, expectedLines) {
    for (const line of expectedLines) {
      expect(output).toContain(line);
    }
  }

  test('prints next reporter banner and summary contract', async () => {
    await withFixtureProject(async ({ tempDir, fixturePath }) => {
      const run = runCli(tempDir, ['--next']);
      expect(run.status).toBe(0);
      const normalized = normalizeOutput(run.output, fixturePath);
      expectIncludesAll(normalized, [
        '⚖️  THEMIS v<VERSION>',
        'AI UNIT TEST FRAMEWORK',
        'AI’S VERDICT ENGINE',
        '████████╗██╗  ██╗███████╗███╗   ███╗██╗███████╗',
        'THEMIS NEXT REPORT',
        'started <ISO_TIMESTAMP>  workers <WORKERS>  duration <MS>',
        'PASS 1  FAIL 0  SKIP 0  TOTAL 1',
        '[PASS] <FIXTURE_TEST_FILE> (1 pass, 0 fail, 0 skip, <MS>)',
        'Slowest Tests',
        'cli fixture > works',
        'Agent Loop Commands',
        'rerun failed: npx themis test --rerun-failed --reporter next',
        'targeted rerun: npx themis test --match "<regex>" --reporter next'
      ]);
    });
  });

  test('prints spec reporter banner and summary contract', async () => {
    await withFixtureProject(async ({ tempDir, fixturePath }) => {
      const run = runCli(tempDir, ['--reporter', 'spec']);
      expect(run.status).toBe(0);
      const normalized = normalizeOutput(run.output, fixturePath);
      expectIncludesAll(normalized, [
        '⚖️  THEMIS v<VERSION>',
        '████████╗██╗  ██╗███████╗███╗   ███╗██╗███████╗',
        '<FIXTURE_TEST_FILE>',
        'PASS cli fixture > works (<MS>)',
        '1/1 passed, 0 failed, 0 skipped in <MS>'
      ]);
      expect(normalized.includes('THEMIS NEXT REPORT')).toBe(false);
    });
  });

  test('does not print banner for --json reporter', async () => {
    await withFixtureProject(async ({ tempDir }) => {
      const run = runCli(tempDir, ['--json']);
      expect(run.status).toBe(0);
      expect(run.output.includes('THEMIS v')).toBe(false);
      expect(run.output.includes('████████')).toBe(false);
    });
  });

  test('writes html report to default artifact path', async () => {
    await withFixtureProject(async ({ tempDir }) => {
      const run = runCli(tempDir, ['--reporter', 'html']);
      expect(run.status).toBe(0);
      expect(run.output.includes('HTML report written to')).toBe(true);

      const reportPath = path.join(tempDir, '.themis', 'reports', 'report.html');
      expect(fs.existsSync(reportPath)).toBe(true);
      const html = fs.readFileSync(reportPath, 'utf8');
      expect(html.includes('<title>Themis Test Report')).toBe(true);
      expect(html.includes('THEMIS TEST REPORT')).toBe(true);
      expect(html.includes('All Checks Cleared')).toBe(true);
      expect(html.includes('themis-bg.png')).toBe(true);
      expect(html.includes('themis-report.png')).toBe(true);
      expect(html.includes('Quick Actions')).toBe(true);
      expect(html.includes('View tests')).toBe(true);
      expect(html.includes('data-copy-text')).toBe(true);
      expect(html.includes('No failing tests in this file.')).toBe(true);
      expect(html.includes('Official Mark')).toBe(false);

      const bgPath = path.join(tempDir, '.themis', 'reports', 'themis-bg.png');
      expect(fs.existsSync(bgPath)).toBe(true);
      const reportAssetPath = path.join(tempDir, '.themis', 'reports', 'themis-report.png');
      expect(fs.existsSync(reportAssetPath)).toBe(true);
    });
  });

  test('surfaces contract diffs in next reporter and html report', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        let run = runCliCommand(tempDir, 'test', ['--next']);
        expect(run.status).toBe(0);

        fs.writeFileSync(
          path.join(tempDir, 'tests', 'contract.test.js'),
          `test('contract drift', () => {\n  captureContract('banner', { label: 'changed' });\n});\n`,
          'utf8'
        );

        run = runCliCommand(tempDir, 'test', ['--next']);
        expect(run.status).toBe(1);
        expect(run.output).toContain('Contract Diffs');
        expect(run.output).toContain('DRIFTED');

        run = runCliCommand(tempDir, 'test', ['--reporter', 'html']);
        expect(run.status).toBe(1);
        const html = fs.readFileSync(path.join(tempDir, '.themis', 'reports', 'report.html'), 'utf8');
        expect(html).toContain('Contract Diffs');
        expect(html).toContain('Update Contracts');
      },
      {
        'tests/contract.test.js': `test('contract drift', () => {\n  captureContract('banner', { label: 'initial' });\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.js$',
        reporter: 'json',
        environment: 'node',
        setupFiles: [],
        tsconfigPath: null
      }
    );
  });

  test('writes next-gen html report with stability and clusters', async () => {
    await withFixtureProject(
      async ({ tempDir }) => {
        const reportPath = path.join(tempDir, 'reports', 'next-gen.html');
        const run = runCli(tempDir, ['--reporter', 'html', '--stability', '2', '--html-output', reportPath]);
        expect(run.status).toBe(1);
        expect(run.output.includes(`HTML report written to ${reportPath}`)).toBe(true);

        expect(fs.existsSync(reportPath)).toBe(true);
        const html = fs.readFileSync(reportPath, 'utf8');
        expect(html.includes('THEMIS TEST REPORT')).toBe(true);
        expect(html.includes('Action Needed')).toBe(true);
        expect(html.includes('Stability Gate')).toBe(true);
        expect(html.includes('UNSTABLE')).toBe(true);
        expect(html.includes('Failure Clusters')).toBe(true);
        expect(html.includes('themis-bg.png')).toBe(true);
        expect(html.includes('themis-report.png')).toBe(true);
        expect(html.includes('Primary Failures')).toBe(true);
        expect(html.includes('Quick Actions')).toBe(true);
        expect(html.includes('View tests')).toBe(true);
        expect(html.includes('Official Mark')).toBe(false);

        const bgPath = path.join(tempDir, 'reports', 'themis-bg.png');
        expect(fs.existsSync(bgPath)).toBe(true);
        const reportAssetPath = path.join(tempDir, 'reports', 'themis-report.png');
        expect(fs.existsSync(reportAssetPath)).toBe(true);
      },
      `const fs = require('fs');
const path = require('path');

test('deterministic instability', () => {
  const marker = path.join(__dirname, 'toggle.txt');
  if (fs.existsSync(marker)) {
    fs.rmSync(marker);
    expect(1).toBe(2);
    return;
  }

  fs.writeFileSync(marker, '1', 'utf8');
  expect(1).toBe(1);
});\n`
    );
  });

  test('emits agent payload with fingerprints and failure clusters', async () => {
    await withFixtureProject(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--agent']);
        expect(run.status).toBe(1);
        expect(run.output.includes('THEMIS v')).toBe(false);

        const payload = JSON.parse(run.output);
        expect(payload.schema).toBe('themis.agent.result.v1');
        expect(payload.analysis.fingerprintVersion).toBe('fnv1a32-message-v1');
        expect(payload.failures.length).toBe(2);
        expect(payload.analysis.failureClusters.length).toBe(1);
        expect(payload.analysis.failureClusters[0].count).toBe(2);
        expect(payload.analysis.failureClusters[0].fingerprint).toBe(payload.failures[0].fingerprint);
        expect(payload.analysis.comparison.status).toBe('baseline');
        expect(payload.artifacts.runDiff).toBe('.themis/diffs/run-diff.json');
      },
      `describe('agent contract', () => {
  test('first fail', () => {
    expect(1).toBe(2);
  });

  test('second fail', () => {
    expect(1).toBe(2);
  });
});\n`
    );
  });

  test('supports themis lexicon for human-readable next output', async () => {
    await withFixtureProject(async ({ tempDir }) => {
      const run = runCli(tempDir, ['--next', '--lexicon', 'themis']);
      expect(run.status).toBe(0);
      expect(run.output.includes('CLEAR 1')).toBe(true);
      expect(run.output.includes('BREACH 0')).toBe(true);
      expect(run.output.includes('DEFERRED 0')).toBe(true);
      expect(run.output.includes('DOCKET 1')).toBe(true);
      expect(run.output.includes('[CLEAR]')).toBe(true);
    });
  });

  test('supports themis lexicon for human-readable spec output', async () => {
    await withFixtureProject(async ({ tempDir }) => {
      const run = runCli(tempDir, ['--reporter', 'spec', '--lexicon', 'themis']);
      expect(run.status).toBe(0);
      expect(run.output.includes('CLEAR cli fixture > works')).toBe(true);
      expect(run.output.includes('1/1 clear, 0 breach, 0 deferred')).toBe(true);
    });
  });

  test('rejects unsupported lexicon values', async () => {
    await withFixtureProject(async ({ tempDir }) => {
      const run = runCli(tempDir, ['--next', '--lexicon', 'future']);
      expect(run.status).toBe(1);
      expect(run.output.includes('Unsupported --lexicon value: future')).toBe(true);
    });
  });

  test('rejects invalid --workers values', async () => {
    await withFixtureProject(async ({ tempDir }) => {
      const run = runCli(tempDir, ['--next', '--workers', 'abc']);
      expect(run.status).toBe(1);
      expect(run.output.includes('Invalid --workers value: abc')).toBe(true);
    });
  });

  test('rejects invalid --stability values', async () => {
    await withFixtureProject(async ({ tempDir }) => {
      const run = runCli(tempDir, ['--next', '--stability', '0']);
      expect(run.status).toBe(1);
      expect(run.output.includes('Invalid --stability value: 0')).toBe(true);
    });
  });

  test('reports unstable classifications in --agent stability analysis', async () => {
    await withFixtureProject(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--agent', '--stability', '2']);
        expect(run.status).toBe(1);
        expect(run.output.includes('THEMIS v')).toBe(false);

        const payload = JSON.parse(run.output);
        expect(payload.analysis.stability.runs).toBe(2);
        expect(payload.analysis.stability.summary.unstable).toBe(1);
        expect(payload.analysis.stability.summary.stablePass).toBe(0);
        expect(payload.analysis.stability.summary.stableFail).toBe(0);
        expect(payload.analysis.stability.tests[0].classification).toBe('unstable');
        expect(payload.analysis.stability.tests[0].statuses).toEqual(['passed', 'failed']);
      },
      `const fs = require('fs');
const path = require('path');

test('deterministic instability', () => {
  const marker = path.join(__dirname, 'toggle.txt');
  if (fs.existsSync(marker)) {
    fs.rmSync(marker);
    expect(1).toBe(2);
    return;
  }

  fs.writeFileSync(marker, '1', 'utf8');
  expect(1).toBe(1);
});\n`
    );
  });

  test('prints stability gate details in next reporter', async () => {
    await withFixtureProject(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--next', '--stability', '2']);
        expect(run.status).toBe(1);
        expect(run.output.includes('Stability Gate')).toBe(true);
        expect(run.output.includes('UNSTABLE')).toBe(true);
        expect(run.output.includes('Failure Clusters')).toBe(true);
      },
      `const fs = require('fs');
const path = require('path');

test('deterministic instability', () => {
  const marker = path.join(__dirname, 'toggle.txt');
  if (fs.existsSync(marker)) {
    fs.rmSync(marker);
    expect(1).toBe(2);
    return;
  }

  fs.writeFileSync(marker, '1', 'utf8');
  expect(1).toBe(1);
});\n`
    );
  });

  test('handles corrupted failed-test artifacts without crashing rerun flow', async () => {
    await withFixtureProject(async ({ tempDir }) => {
      const artifactDir = path.join(tempDir, '.themis', 'runs');
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, 'failed-tests.json'), '{not json', 'utf8');

      const run = runCli(tempDir, ['--rerun-failed', '--reporter', 'spec']);
      expect(run.status).toBe(0);
      expect(run.output.includes('Failed to parse failed test artifact')).toBe(true);
    });
  });

  test('initializes config without sample tests and gitignores .themis artifacts', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-cli-init-'));

    try {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\n', 'utf8');

      const run = runCliCommand(tempDir, 'init', []);
      expect(run.status).toBe(0);
      expect(run.output).toContain('Themis initialized. Next: npx themis generate src && npx themis test');

      expect(fs.existsSync(path.join(tempDir, 'themis.config.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'tests', 'example.test.js'))).toBe(false);
      expect(fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf8')).toContain('.themis/');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('supports --fix for stale generated suites and keeps json output machine-readable', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-cli-fix-'));

    try {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'src', 'math.js'),
        `module.exports = {\n  add(a, b) {\n    return a + b;\n  }\n};\n`,
        'utf8'
      );

      let run = runCliCommand(tempDir, 'generate', ['src']);
      expect(run.status).toBe(0);

      fs.writeFileSync(
        path.join(tempDir, 'src', 'math.js'),
        `module.exports = {\n  subtract(a, b) {\n    return a - b;\n  }\n};\n`,
        'utf8'
      );

      run = runCli(tempDir, ['--fix', '--json']);
      expect(run.status).toBe(0);

      const payload = JSON.parse(run.output);
      expect(payload.summary.failed).toBe(0);
      expect(fs.existsSync(path.join(tempDir, '.themis', 'runs', 'fix-handoff.json'))).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('applies --no-memes flag in CLI worker execution', async () => {
    await withFixtureProject(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--json', '--no-memes']);
        expect(run.status).toBe(1);
        expect(run.output.includes('THEMIS v')).toBe(false);

        const payload = JSON.parse(run.output);
        expect(payload.summary.failed).toBe(1);
        expect(payload.files[0].tests[0].name).toBe('load');
        expect(payload.files[0].tests[0].error.message).toContain('cook');
      },
      `intent('meme cli fixture', ({ cook, vibecheck }) => {
  cook('seed state', (ctx) => {
    ctx.score = 41;
  });

  vibecheck('score reaches 42', (ctx) => {
    expect(ctx.score + 1).toBe(42);
  });
});\n`
    );
  });
  test('supports modern tsconfig path aliases and jsdom config through the CLI', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--json']);
        expect(run.status).toBe(0);

        const payload = JSON.parse(run.output);
        expect(payload.summary.total).toBe(1);
        expect(payload.summary.passed).toBe(1);
        expect(payload.files[0].tests[0].status).toBe('passed');
      },
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
        'tests/setup.ts': `beforeEach(() => {\n  document.body.dataset.ready = 'ready';\n});\n`,
        'tests/sample.test.tsx': `import { makeBanner } from '@app/view';\n\ntest('modern project support', () => {\n  const banner = makeBanner(document.body.dataset.ready || 'missing');\n  expect(banner.children[0]).toBe('ready');\n});\n`
      }
    );
  });

  test('honors testIgnore patterns during discovery', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--json']);
        expect(run.status).toBe(0);

        const payload = JSON.parse(run.output);
        expect(payload.summary.total).toBe(1);
        expect(payload.summary.passed).toBe(1);
        expect(payload.files).toHaveLength(1);
        expect(payload.files[0].file).toContain(path.join('tests', 'sample.test.js'));
      },
      {
        'tests/sample.test.js': `test('main suite test', () => {\n  expect('themis').toBe('themis');\n});\n`,
        'tests/generated/noise.test.js': `test('generated noise should be ignored', () => {\n  throw new Error('discovery leak');\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.js$',
        reporter: 'json',
        environment: 'node',
        setupFiles: [],
        tsconfigPath: null,
        testIgnore: ['^tests/generated(?:/|$)']
      }
    );
  });

  test('rejects invalid testIgnore config values', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--json']);
        expect(run.status).toBe(1);
        expect(run.output).toContain('Invalid config testIgnore value: expected an array of regex strings.');
      },
      {
        'tests/sample.test.js': `test('direct contract fixture', () => {\n  expect(true).toBe(true);\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.js$',
        reporter: 'json',
        environment: 'node',
        setupFiles: [],
        tsconfigPath: null,
        testIgnore: [42]
      }
    );
  });

  test('rejects unsupported isolation values', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--json', '--isolation', 'fork']);
        expect(run.status).toBe(1);
        expect(run.output).toContain('Unsupported --isolation value: fork. Use one of: worker, in-process.');
      },
      {
        'tests/sample.test.js': `test('direct contract fixture', () => {\n  expect(true).toBe(true);\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.js$',
        reporter: 'json',
        environment: 'node',
        setupFiles: [],
        tsconfigPath: null
      }
    );
  });

  test('rejects the removed snapshot update flag', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const run = runCli(tempDir, ['--json', '-u']);
        expect(run.status).toBe(1);
        expect(run.output).toContain('Snapshots have been removed from Themis.');
        expect(run.output).toContain('Replace -u/--update-snapshots with direct assertions or generated contract flows.');
      },
      {
        'tests/sample.test.js': `test('direct contract fixture', () => {\n  expect({ state: 'initial' }).toMatchObject({ state: 'initial' });\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.js$',
        reporter: 'json',
        environment: 'node',
        setupFiles: [],
        tsconfigPath: null
      }
    );
  });

  test('scaffolds an incremental jest migration bridge', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const run = runCliCommand(tempDir, 'migrate', ['jest']);
        expect(run.status).toBe(0);
        expect(run.output).toContain('Themis migration scaffold created for jest.');
        expect(run.output).toContain('Runtime compatibility is enabled for @jest/globals, vitest, and @testing-library/react imports.');

        const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'themis.config.json'), 'utf8'));
        expect(config.setupFiles).toContain('tests/setup.themis.js');

        const setupSource = fs.readFileSync(path.join(tempDir, 'tests', 'setup.themis.js'), 'utf8');
        expect(setupSource).toContain('Themis migration bridge for jest suites.');

        const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
        expect(packageJson.scripts['test:themis']).toBe('themis test');
        expect(fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf8')).toContain('.themis/');

        const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.themis', 'migration', 'migration-report.json'), 'utf8'));
        expect(report.schema).toBe('themis.migration.report.v1');
        expect(report.summary.matchedFiles).toBe(1);
        expect(report.summary.jestGlobals).toBe(1);
      },
      {
        'package.json': `{\n  "name": "themis-migrate-fixture",\n  "private": true,\n  "version": "0.0.0",\n  "scripts": {\n    "test": "jest"\n  }\n}\n`,
        'tests/sample.test.js': `import { describe, test, expect } from '@jest/globals';\n\ndescribe('migration placeholder', () => {\n  test('works', () => {\n    expect(true).toBe(true);\n  });\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.js$',
        reporter: 'json',
        environment: 'node',
        setupFiles: [],
        tsconfigPath: null
      }
    );
  });

  test('rewrites Jest and Testing Library imports to a local Themis compatibility module', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const run = runCliCommand(tempDir, 'migrate', ['jest', '--rewrite-imports']);
        expect(run.status).toBe(0);
        expect(run.output).toContain('Imports: rewrote 1 file(s) to local Themis compatibility imports.');

        const compatSource = fs.readFileSync(path.join(tempDir, 'themis.compat.js'), 'utf8');
        expect(compatSource).toContain('module.exports');
        expect(compatSource).toContain('jest: jestLike');
        expect(compatSource).toContain('vi: jestLike');

        const testSource = fs.readFileSync(path.join(tempDir, 'tests', 'sample.test.jsx'), 'utf8');
        expect(testSource).toContain(`from '../themis.compat.js'`);
        expect(testSource.includes(`@jest/globals`)).toBe(false);
        expect(testSource.includes(`@testing-library/react`)).toBe(false);

        const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.themis', 'migration', 'migration-report.json'), 'utf8'));
        expect(report.summary.rewrittenFiles).toBe(1);
        expect(report.summary.rewrittenImports).toBe(2);
        expect(report.rewrites).toEqual(['tests/sample.test.jsx']);

        const rerun = runCliCommand(tempDir, 'test', ['--json']);
        expect(rerun.status).toBe(0);
        const payload = JSON.parse(rerun.output);
        expect(payload.summary.failed).toBe(0);
      },
      {
        'package.json': `{\n  "name": "themis-migrate-rewrite-fixture",\n  "private": true,\n  "version": "0.0.0",\n  "scripts": {\n    "test": "jest"\n  }\n}\n`,
        'tsconfig.json': `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "CommonJS",\n    "jsx": "react-jsx",\n    "allowJs": true\n  }\n}\n`,
        'node_modules/react/index.js': "module.exports = {};\n",
        'node_modules/react/jsx-runtime.js': "exports.Fragment = Symbol.for('react.fragment'); exports.jsx = (type, props, key) => ({ $$typeof: 'react.test.element', type, key: key || null, props: props || {} }); exports.jsxs = exports.jsx;\n",
        'tests/sample.test.jsx': `import { describe, test, expect } from '@jest/globals';\nimport { render, screen, cleanup } from '@testing-library/react';\n\nfunction Banner() {\n  return <h1>Themis migration</h1>;\n}\n\ndescribe('migration rewrite', () => {\n  test('works after import rewrite', () => {\n    render(<Banner />);\n    expect(screen.getByText('Themis migration')).toBeInTheDocument();\n    cleanup();\n  });\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.(js|jsx)$',
        reporter: 'json',
        environment: 'jsdom',
        setupFiles: [],
        tsconfigPath: 'tsconfig.json'
      }
    );
  });

  test('updates captured contracts only when explicitly requested', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        let run = runCliCommand(tempDir, 'test', ['--json']);
        expect(run.status).toBe(0);
        let payload = JSON.parse(run.output);
        expect(payload.summary.failed).toBe(0);

        fs.writeFileSync(
          path.join(tempDir, 'tests', 'contract.test.js'),
          `test('contract example', () => {\n  captureContract('banner', { label: 'changed', stable: true });\n});\n`,
          'utf8'
        );

        run = runCliCommand(tempDir, 'test', ['--json']);
        expect(run.status).toBe(1);
        payload = JSON.parse(run.output);
        expect(payload.summary.failed).toBe(1);

        const contractDiff = JSON.parse(fs.readFileSync(path.join(tempDir, '.themis', 'diffs', 'contract-diff.json'), 'utf8'));
        expect(contractDiff.summary.drifted).toBe(1);

        run = runCliCommand(tempDir, 'test', ['--json', '--update-contracts']);
        expect(run.status).toBe(0);
        payload = JSON.parse(run.output);
        expect(payload.summary.failed).toBe(0);
      },
      {
        'tests/contract.test.js': `test('contract example', () => {\n  captureContract('banner', { label: 'initial', stable: true });\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.js$',
        reporter: 'json',
        environment: 'node',
        setupFiles: [],
        tsconfigPath: null
      }
    );
  });

  test('converts common Jest matcher patterns into Themis-native assertions', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const run = runCliCommand(tempDir, 'migrate', ['jest', '--convert']);
        expect(run.status).toBe(0);
        expect(run.output).toContain('Codemods: converted 1 file(s) to Themis-native patterns.');

        const testSource = fs.readFileSync(path.join(tempDir, 'tests', 'sample.test.js'), 'utf8');
        expect(testSource.includes('@jest/globals')).toBe(false);
        expect(testSource).toContain('test(');
        expect(testSource).toContain('.toEqual(');
        expect(testSource).toContain('.toHaveBeenCalledTimes(');

        const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.themis', 'migration', 'migration-report.json'), 'utf8'));
        expect(report.summary.convertedFiles).toBe(1);
        expect(report.summary.convertedAssertions).toBe(4);
      },
      {
        'package.json': `{\n  "name": "themis-migrate-convert-fixture",\n  "private": true,\n  "version": "0.0.0",\n  "scripts": {\n    "test": "jest"\n  }\n}\n`,
        'tests/sample.test.js': `import { describe, it, expect } from '@jest/globals';\n\ndescribe('migration convert', () => {\n  it('normalizes matchers', () => {\n    const worker = fn();\n    worker('ok');\n    expect({ status: 'ok' }).toStrictEqual({ status: 'ok' });\n    expect([1, 2]).toContainEqual(2);\n    expect(worker).toBeCalledTimes(1);\n  });\n});\n`
      },
      {
        testRegex: '\\.(test|spec)\\.js$',
        reporter: 'json',
        environment: 'node',
        setupFiles: [],
        tsconfigPath: null
      }
    );
  });
});
