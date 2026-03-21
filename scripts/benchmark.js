#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { performance } = require('perf_hooks');

const rootDir = path.resolve(__dirname, '..');
const benchDir = path.join(rootDir, '.themis-bench');
const benchTestsDir = path.join(benchDir, 'tests');

const DEFAULTS = {
  files: 40,
  testsPerFile: 25,
  repeats: 3,
  workers: 4,
  includeExternal: false
};

function runBenchmark(overrides = {}) {
  const options = resolveOptions(overrides);
  prepareSuite(options);

  const commands = buildCommands(options.includeExternal);
  const results = [];

  for (const tool of commands) {
    if (!canRun(tool)) {
      continue;
    }

    const samples = [];
    for (let i = 0; i < options.repeats; i += 1) {
      const startedAt = performance.now();
      const proc = spawnSync(tool.cmd[0], tool.cmd.slice(1), {
        cwd: benchDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
      const elapsed = Math.round((performance.now() - startedAt) * 100) / 100;

      if (proc.status !== 0) {
        const error = new Error(`${tool.name} failed on repeat ${i + 1}`);
        error.details = {
          stdout: compactOutput(proc.stdout),
          stderr: compactOutput(proc.stderr)
        };
        throw error;
      }

      samples.push(elapsed);
    }

    const average = Math.round((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 100) / 100;
    results.push({ name: tool.name, samples, average });
  }

  results.sort((a, b) => a.average - b.average);

  return {
    options,
    results
  };
}

function resolveOptions(overrides) {
  const options = {
    files: resolveNumber(overrides.files, process.env.BENCH_FILES, DEFAULTS.files),
    testsPerFile: resolveNumber(overrides.testsPerFile, process.env.BENCH_TESTS_PER_FILE, DEFAULTS.testsPerFile),
    repeats: resolveNumber(overrides.repeats, process.env.BENCH_REPEATS, DEFAULTS.repeats),
    workers: resolveNumber(overrides.workers, process.env.BENCH_WORKERS, DEFAULTS.workers),
    includeExternal: resolveBoolean(overrides.includeExternal, process.env.BENCH_INCLUDE_EXTERNAL, DEFAULTS.includeExternal)
  };

  assertPositiveInteger('files', options.files);
  assertPositiveInteger('testsPerFile', options.testsPerFile);
  assertPositiveInteger('repeats', options.repeats);
  assertPositiveInteger('workers', options.workers);

  return options;
}

function resolveNumber(override, envValue, fallback) {
  if (override !== undefined && override !== null) {
    return Number(override);
  }
  if (envValue !== undefined) {
    return Number(envValue);
  }
  return fallback;
}

function resolveBoolean(override, envValue, fallback) {
  if (override !== undefined && override !== null) {
    return Boolean(override);
  }
  if (envValue !== undefined) {
    return envValue === '1';
  }
  return fallback;
}

function assertPositiveInteger(name, value) {
  if (Number.isInteger(value) && value > 0) {
    return;
  }
  throw new Error(`Invalid benchmark option "${name}": expected a positive integer, received "${value}"`);
}

function buildCommands(includeExternal) {
  return [
    { name: 'themis', cmd: ['node', path.join(rootDir, 'bin/themis.js'), 'test', '--reporter', 'json'] },
    ...(includeExternal
      ? [
          { name: 'jest', cmd: ['npx', '--no-install', 'jest', '--runInBand', '--json', '--rootDir', '.', 'tests'] },
          { name: 'vitest', cmd: ['npx', '--no-install', 'vitest', 'run', 'tests', '--reporter=json'] },
          { name: 'bun', cmd: ['bun', 'test', 'tests'] }
        ]
      : [])
  ];
}

function prepareSuite(options) {
  fs.rmSync(benchDir, { recursive: true, force: true });
  fs.mkdirSync(benchTestsDir, { recursive: true });

  fs.writeFileSync(
    path.join(benchDir, 'themis.config.json'),
    `${JSON.stringify({
      testDir: 'tests',
      testRegex: '\\.(test|spec)\\.js$',
      maxWorkers: options.workers,
      reporter: 'json'
    }, null, 2)}\n`,
    'utf8'
  );

  for (let fileIndex = 0; fileIndex < options.files; fileIndex += 1) {
    const lines = [];
    lines.push(`describe('bench file ${fileIndex}', () => {`);
    lines.push('  let value = 0;');
    lines.push('  beforeEach(() => { value = 41; });');
    for (let testIndex = 0; testIndex < options.testsPerFile; testIndex += 1) {
      lines.push(`  test('case ${testIndex}', () => { expect(value + 1).toBe(42); });`);
    }
    lines.push('});');

    fs.writeFileSync(path.join(benchTestsDir, `bench-${fileIndex}.test.js`), `${lines.join('\n')}\n`, 'utf8');
  }
}

function canRun(tool) {
  if (tool.name === 'themis') {
    return true;
  }

  const probe = probeCommand(tool);

  return probe.status === 0;
}

function probeCommand(tool) {
  if (tool.cmd[0] === 'npx') {
    const pkg = tool.cmd[2];
    return spawnSync('npx', ['--no-install', pkg, '--version'], {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf8'
    });
  }

  return spawnSync(tool.cmd[0], ['--version'], {
    cwd: rootDir,
    stdio: 'pipe',
    encoding: 'utf8'
  });
}

function compactOutput(output) {
  if (!output) {
    return '';
  }
  const lines = output.trim().split('\n');
  if (lines.length <= 60) {
    return output;
  }
  const head = lines.slice(0, 30);
  const tail = lines.slice(-30);
  return `${head.join('\n')}\n... (${lines.length - 60} lines omitted) ...\n${tail.join('\n')}`;
}

function printBenchmarkReport(payload) {
  const { options, results } = payload;

  if (results.length === 0) {
    console.log('No runners available. Install Jest/Vitest/Bun locally if you want cross-runner comparison.');
    return;
  }

  console.log(`Benchmark suite: ${options.files} files x ${options.testsPerFile} tests, repeats=${options.repeats}`);
  for (const entry of results) {
    console.log(`${entry.name.padEnd(8)} avg=${String(entry.average).padStart(8)}ms samples=${entry.samples.join(', ')}`);
  }
}

function main() {
  try {
    const payload = runBenchmark();
    printBenchmarkReport(payload);
  } catch (error) {
    console.error(error?.message || String(error));
    if (error?.details?.stdout) {
      console.error(error.details.stdout);
    }
    if (error?.details?.stderr) {
      console.error(error.details.stderr);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runBenchmark
};
