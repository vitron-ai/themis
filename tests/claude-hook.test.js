const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK_PATH = path.resolve(__dirname, '..', 'scripts', 'claude-hook.js');
const REPO_THEMIS_BIN = path.resolve(__dirname, '..', 'bin', 'themis.js');

function runHook(cwd, payload, env = {}) {
  return spawnSync(process.execPath, [HOOK_PATH], {
    cwd,
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function makeTempProject(prefix) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `themis-hook-${prefix}-`));
  return tempDir;
}

function installLocalThemisShim(tempDir) {
  // The hook prefers `node_modules/@vitronai/themis/bin/themis.js`. We point
  // that path at the in-repo bin so the hook exercises the real CLI.
  const pkgDir = path.join(tempDir, 'node_modules', '@vitronai', 'themis', 'bin');
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(pkgDir, 'themis.js'),
    `#!/usr/bin/env node\nrequire(${JSON.stringify(REPO_THEMIS_BIN)});\n`,
    'utf8'
  );
}

describe('claude-hook', () => {
  test('exits silently when THEMIS_HOOK_DISABLED is set', () => {
    const tempDir = makeTempProject('disabled');
    try {
      const payload = { tool_name: 'Edit', tool_input: { file_path: path.join(tempDir, 'src/foo.ts') }, cwd: tempDir };
      const result = runHook(tempDir, payload, { THEMIS_HOOK_DISABLED: '1' });
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('exits silently when stdin payload is empty or invalid', () => {
    const tempDir = makeTempProject('invalid');
    try {
      expect(runHook(tempDir, '').status).toBe(0);
      expect(runHook(tempDir, 'not json').status).toBe(0);
      expect(runHook(tempDir, {}).status).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('exits silently for non-source file extensions', () => {
    const tempDir = makeTempProject('ext');
    try {
      const payload = { tool_name: 'Edit', tool_input: { file_path: path.join(tempDir, 'README.md') }, cwd: tempDir };
      const result = runHook(tempDir, payload);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('exits silently for edits inside ignored directories', () => {
    const tempDir = makeTempProject('ignored');
    try {
      const ignoredCases = [
        path.join(tempDir, '.themis', 'runs', 'last-run.json'),
        path.join(tempDir, '__themis__', 'tests', 'foo.generated.test.ts'),
        path.join(tempDir, 'node_modules', 'pkg', 'index.js'),
        path.join(tempDir, '.git', 'HEAD')
      ];
      for (const filePath of ignoredCases) {
        const payload = { tool_name: 'Edit', tool_input: { file_path: filePath }, cwd: tempDir };
        const result = runHook(tempDir, payload);
        expect(result.status).toBe(0);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('runs themis and exits silent when the suite is green after a real source edit', () => {
    const tempDir = makeTempProject('green');
    try {
      installLocalThemisShim(tempDir);
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'src', 'math.ts'),
        'export function add(a: number, b: number) {\n  return a + b;\n}\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'tests', 'math.test.js'),
        `const { add } = require('../src/math.ts');\ntest('add works', () => {\n  expect(add(1, 2)).toBe(3);\n});\n`,
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'themis.config.json'),
        JSON.stringify({ testDir: 'tests', testRegex: '\\.(test|spec)\\.js$', maxWorkers: 1, reporter: 'json' }, null, 2),
        'utf8'
      );

      const payload = {
        tool_name: 'Edit',
        tool_input: { file_path: path.join(tempDir, 'src', 'math.ts') },
        cwd: tempDir
      };
      const result = runHook(tempDir, payload);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('surfaces failures via stderr and exit 2 when the suite is red', () => {
    const tempDir = makeTempProject('red');
    try {
      installLocalThemisShim(tempDir);
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'src', 'math.ts'),
        'export function add(a: number, b: number) {\n  return a - b;\n}\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'tests', 'math.test.js'),
        `const { add } = require('../src/math.ts');\ntest('add works', () => {\n  expect(add(1, 2)).toBe(3);\n});\n`,
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'themis.config.json'),
        JSON.stringify({ testDir: 'tests', testRegex: '\\.(test|spec)\\.js$', maxWorkers: 1, reporter: 'json' }, null, 2),
        'utf8'
      );

      const payload = {
        tool_name: 'Edit',
        tool_input: { file_path: path.join(tempDir, 'src', 'math.ts') },
        cwd: tempDir
      };
      const result = runHook(tempDir, payload);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Themis tests failed after edit');
      expect(result.stderr).toContain('failures');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
