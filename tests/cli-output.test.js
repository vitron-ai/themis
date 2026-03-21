const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'themis.js');
const SNAPSHOT_PATH = path.join(__dirname, 'snapshots', 'cli-output.snapshots.json');
const SNAPSHOTS = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

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
    const result = spawnSync(process.execPath, [CLI_PATH, 'test', ...args], {
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
    } catch (error) {
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

  function assertSnapshot(snapshotName, normalizedOutput) {
    const expected = SNAPSHOTS[snapshotName];
    if (typeof expected !== 'string') {
      throw new Error(`Missing CLI snapshot: ${snapshotName}`);
    }
    expect(normalizedOutput).toBe(expected);
  }

  test('matches snapshot for --next reporter with banner', async () => {
    await withFixtureProject(async ({ tempDir, fixturePath }) => {
      const run = runCli(tempDir, ['--next']);
      expect(run.status).toBe(0);
      const normalized = normalizeOutput(run.output, fixturePath);
      assertSnapshot('next_report_with_banner', normalized);
    });
  });

  test('matches snapshot for --reporter spec with banner', async () => {
    await withFixtureProject(async ({ tempDir, fixturePath }) => {
      const run = runCli(tempDir, ['--reporter', 'spec']);
      expect(run.status).toBe(0);
      const normalized = normalizeOutput(run.output, fixturePath);
      assertSnapshot('spec_report_with_banner', normalized);
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

      const reportPath = path.join(tempDir, '.themis', 'report.html');
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

      const bgPath = path.join(tempDir, '.themis', 'themis-bg.png');
      expect(fs.existsSync(bgPath)).toBe(true);
      const reportAssetPath = path.join(tempDir, '.themis', 'themis-report.png');
      expect(fs.existsSync(reportAssetPath)).toBe(true);
    });
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
        expect(payload.artifacts.runDiff).toBe('.themis/run-diff.json');
        expect(payload.hints.updateSnapshots).toBe('npx themis test -u');
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
      const artifactDir = path.join(tempDir, '.themis');
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, 'failed-tests.json'), '{not json', 'utf8');

      const run = runCli(tempDir, ['--rerun-failed', '--reporter', 'spec']);
      expect(run.status).toBe(0);
      expect(run.output.includes('Failed to parse failed test artifact')).toBe(true);
    });
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

  test('updates snapshots through the CLI update flag', async () => {
    await withProjectFiles(
      async ({ tempDir }) => {
        const fixturePath = path.join(tempDir, 'tests', 'sample.test.js');
        const snapshotPath = path.join(tempDir, 'tests', '__snapshots__', 'sample.test.js.snapshots.json');

        let run = runCli(tempDir, ['--json']);
        expect(run.status).toBe(0);
        let payload = JSON.parse(run.output);
        expect(payload.summary.passed).toBe(1);
        expect(fs.existsSync(snapshotPath)).toBe(true);

        fs.writeFileSync(
          fixturePath,
          `test('snapshot fixture', () => {\n  expect({ state: 'changed' }).toMatchSnapshot();\n});\n`,
          'utf8'
        );

        run = runCli(tempDir, ['--json']);
        expect(run.status).toBe(1);
        payload = JSON.parse(run.output);
        expect(payload.files[0].tests[0].error.message).toContain('Snapshot mismatch');

        run = runCli(tempDir, ['--json', '-u']);
        expect(run.status).toBe(0);
        payload = JSON.parse(run.output);
        expect(payload.summary.passed).toBe(1);

        const snapshots = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        expect(snapshots['snapshot fixture']).toContain('changed');
      },
      {
        'tests/sample.test.js': `test('snapshot fixture', () => {\n  expect({ state: 'initial' }).toMatchSnapshot();\n});\n`
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
