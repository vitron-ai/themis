const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { collectWatchSignature, hasWatchSignatureChanged, stripWatchFlags } = require('../src/watch');

const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'themis.js');

describe('watch mode', () => {
  function hasJsonNumberValue(output, key, value) {
    return new RegExp(`"${key}"\\s*:\\s*${value}(?:\\D|$)`).test(output);
  }

  function withTempDir(run) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-watch-'));

    return Promise.resolve()
      .then(() => run(tempDir))
      .finally(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      });
  }

  function writeProjectFile(rootDir, relativePath, source) {
    const targetPath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, source, 'utf8');
    return targetPath;
  }

  test('strips watch flags from cli args', () => {
    const args = ['--watch', '--json', '-w', '--reporter', 'html'];
    expect(stripWatchFlags(args)).toEqual(['--json', '--reporter', 'html']);
  });

  test('collects signatures only for watched source files', async () => {
    await withTempDir(async (tempDir) => {
      const watchedJs = writeProjectFile(tempDir, 'tests/sample.test.js', `test('works', () => {\n  expect(true).toBe(true);\n});\n`);
      const watchedTs = writeProjectFile(tempDir, 'src/banner.ts', `export const banner = 'themis';\n`);
      writeProjectFile(tempDir, 'assets/logo.png', 'png');
      writeProjectFile(tempDir, '.themis/reports/report.html', '<html></html>');
      writeProjectFile(tempDir, 'node_modules/pkg/index.js', 'module.exports = 1;\n');
      writeProjectFile(tempDir, 'tests/__snapshots__/sample.test.js.snapshots.json', '{}\n');

      const signature = collectWatchSignature(tempDir);

      expect(signature).toHaveLength(2);
      expect(signature[0]).toContain(watchedTs);
      expect(signature[1]).toContain(watchedJs);
      expect(signature.some((entry) => entry.includes('logo.png'))).toBe(false);
      expect(signature.some((entry) => entry.includes('.themis'))).toBe(false);
      expect(signature.some((entry) => entry.includes('__snapshots__'))).toBe(false);
      expect(signature.some((entry) => entry.includes('node_modules'))).toBe(false);
    });
  });

  test('detects watched file changes from the collected signature', async () => {
    await withTempDir(async (tempDir) => {
      const fixturePath = writeProjectFile(tempDir, 'tests/sample.test.js', `test('works', () => {\n  expect(1).toBe(1);\n});\n`);

      const firstSignature = collectWatchSignature(tempDir);
      fs.writeFileSync(
        fixturePath,
        `test('works', () => {\n  expect({ verdict: 'changed', size: 'different' }).toBeTruthy();\n});\n`,
        'utf8'
      );
      const secondSignature = collectWatchSignature(tempDir);

      expect(hasWatchSignatureChanged(firstSignature, secondSignature)).toBe(true);
      expect(hasWatchSignatureChanged(secondSignature, secondSignature)).toBe(false);
    });
  });

  test('re-runs the suite when watched files change', async () => {
    await withTempDir(async (tempDir) => {
      writeProjectFile(
        tempDir,
        'themis.config.json',
        `${JSON.stringify({
          testDir: 'tests',
          testRegex: '\\.(test|spec)\\.js$',
          maxWorkers: 1,
          reporter: 'json'
        }, null, 2)}\n`
      );

      const fixturePath = writeProjectFile(
        tempDir,
        'tests/sample.test.js',
        `test('watch fixture', () => {\n  expect(1).toBe(1);\n});\n`
      );

      const child = spawn(process.execPath, [CLI_PATH, 'test', '--watch', '--json'], {
        cwd: tempDir,
        env: {
          ...process.env,
          NO_COLOR: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let childDone = false;

      try {
        const output = await new Promise((resolve, reject) => {
          let combinedOutput = '';
          let sawInitialPass = false;
          let stopRequested = false;

          const timeoutId = setTimeout(() => {
            reject(new Error(`Watch mode integration test timed out.\n${combinedOutput}`));
          }, 10000);

          const cleanup = () => {
            clearTimeout(timeoutId);
            child.stdout.removeListener('data', onData);
            child.stderr.removeListener('data', onData);
            child.removeListener('error', onError);
            child.removeListener('exit', onExit);
          };

          const onData = (chunk) => {
            combinedOutput += String(chunk);

            if (!sawInitialPass && hasJsonNumberValue(combinedOutput, 'passed', 1) && combinedOutput.includes('Watching for changes...')) {
              sawInitialPass = true;
              fs.writeFileSync(
                fixturePath,
                `test('watch fixture', () => {\n  expect('changed watch rerun state').toBe('different rerun state');\n});\n`,
                'utf8'
              );
              return;
            }

            if (
              sawInitialPass &&
              !stopRequested &&
              combinedOutput.includes('Change detected. Re-running...') &&
              hasJsonNumberValue(combinedOutput, 'failed', 1)
            ) {
              stopRequested = true;
              child.kill('SIGINT');
            }
          };

          const onError = (error) => {
            cleanup();
            reject(error);
          };

          const onExit = () => {
            childDone = true;
            cleanup();
            if (!stopRequested) {
              reject(new Error(`Watch mode exited before a rerun completed.\n${combinedOutput}`));
              return;
            }
            resolve(combinedOutput);
          };

          child.stdout.on('data', onData);
          child.stderr.on('data', onData);
          child.once('error', onError);
          child.once('exit', onExit);
        });

        expect(output.includes('Watching for changes...')).toBe(true);
        expect(output.includes('Change detected. Re-running...')).toBe(true);
        expect(hasJsonNumberValue(output, 'passed', 1)).toBe(true);
        expect(hasJsonNumberValue(output, 'failed', 1)).toBe(true);
        expect(output.includes('Watch mode stopped.')).toBe(true);
      } finally {
        if (!childDone) {
          child.kill('SIGKILL');
        }
      }
    });
  });
});
