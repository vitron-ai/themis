const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { initConfig, loadConfig } = require('../src/config');

const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'themis.js');

function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-config-'));
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('config paths', () => {
  test('init writes forward-slash paths on every platform', () => {
    withTempDir((tempDir) => {
      initConfig(tempDir);
      const written = JSON.parse(fs.readFileSync(path.join(tempDir, 'themis.config.json'), 'utf8'));
      expect(written.generatedTestsDir).toBe('__themis__/tests');
      expect(written.htmlReportPath).toBe('__themis__/reports/report.html');
    });
  });

  test('backslash separators in path fields are normalized on load', () => {
    withTempDir((tempDir) => {
      const raw = {
        testDir: 'tests\\unit',
        generatedTestsDir: '__themis__\\tests',
        htmlReportPath: '__themis__\\reports\\report.html',
        setupFiles: ['tests\\setup.js'],
        tsconfigPath: 'config\\tsconfig.json'
      };
      fs.writeFileSync(path.join(tempDir, 'themis.config.json'), JSON.stringify(raw), 'utf8');

      const config = loadConfig(tempDir);
      expect(config.testDir).toBe('tests/unit');
      expect(config.generatedTestsDir).toBe('__themis__/tests');
      expect(config.htmlReportPath).toBe('__themis__/reports/report.html');
      expect(config.setupFiles).toEqual(['tests/setup.js']);
      expect(config.tsconfigPath).toBe('config/tsconfig.json');
    });
  });

  test('regex fields keep their backslashes', () => {
    withTempDir((tempDir) => {
      const raw = { testRegex: '\\.test\\.js$', testIgnore: ['\\.skip\\.js$'], tsconfigPath: null };
      fs.writeFileSync(path.join(tempDir, 'themis.config.json'), JSON.stringify(raw), 'utf8');

      const config = loadConfig(tempDir);
      expect(config.testRegex).toBe('\\.test\\.js$');
      expect(config.testIgnore).toEqual(['\\.skip\\.js$']);
      expect(config.tsconfigPath).toBeNull();
    });
  });

  test('a config written on Windows still discovers tests on any platform', () => {
    withTempDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'tests', 'unit'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'tests', 'unit', 'sample.test.js'),
        "test('works', () => { expect(1 + 1).toBe(2); });\n",
        'utf8'
      );
      fs.writeFileSync(path.join(tempDir, 'themis.config.json'), JSON.stringify({ testDir: 'tests\\unit' }), 'utf8');

      const run = spawnSync(process.execPath, [CLI_PATH, 'test', '--json'], { cwd: tempDir, encoding: 'utf8' });
      expect(run.status).toBe(0);
      const payload = JSON.parse(run.stdout);
      expect(payload.summary.passed).toBe(1);
    });
  });
});
