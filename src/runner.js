const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { fork } = require('child_process');
const { performance } = require('perf_hooks');
const { collectAndRun } = require('./runtime');

const inProcessResultCache = new Map();

async function runTests(files, options = {}) {
  const startedAt = performance.now();
  const startedAtIso = new Date().toISOString();
  const isolation = resolveIsolationMode(options);
  const maxWorkers = isolation === 'in-process' ? 1 : resolveMaxWorkers(options.maxWorkers);
  const fileResults = isolation === 'in-process'
    ? await runFilesInProcess(files, options)
    : isolation === 'process'
      ? await runFilesInChildProcesses(files, options)
      : await runFilesInWorkers(files, options);

  fileResults.sort((a, b) => a.file.localeCompare(b.file));

  const tests = fileResults.flatMap((entry) => entry.tests);
  const passed = tests.filter((test) => test.status === 'passed').length;
  const failed = tests.filter((test) => test.status === 'failed').length;
  const skipped = tests.filter((test) => test.status === 'skipped').length;
  const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

  return {
    meta: {
      startedAt: startedAtIso,
      finishedAt: new Date().toISOString(),
      maxWorkers
    },
    files: fileResults,
    summary: {
      total: tests.length,
      passed,
      failed,
      skipped,
      durationMs
    }
  };
}

async function runFilesInWorkers(files, options) {
  const queue = [...files];
  const workers = [];
  const fileResults = [];

  for (let i = 0; i < Math.min(resolveMaxWorkers(options.maxWorkers), files.length); i += 1) {
    workers.push(runNext(queue, fileResults, options));
  }

  await Promise.all(workers);
  return fileResults;
}

async function runFilesInProcess(files, options) {
  const fileResults = [];
  for (const file of files) {
    fileResults.push(await runFileInProcess(file, options));
  }
  return fileResults;
}

async function runNext(queue, fileResults, options) {
  while (queue.length > 0) {
    const file = queue.shift();
    if (!file) {
      return;
    }
    const result = await runFileInWorker(file, options);
    fileResults.push(result);
  }
}

async function runFilesInChildProcesses(files, options) {
  const queue = [...files];
  const lanes = [];
  const fileResults = [];

  for (let i = 0; i < Math.min(resolveMaxWorkers(options.maxWorkers), files.length); i += 1) {
    lanes.push(runNextChildProcess(queue, fileResults, options));
  }

  await Promise.all(lanes);
  return fileResults;
}

async function runNextChildProcess(queue, fileResults, options) {
  while (queue.length > 0) {
    const file = queue.shift();
    if (!file) {
      return;
    }
    const result = await runFileInChildProcess(file, options);
    fileResults.push(result);
  }
}

function runFileInChildProcess(file, options = {}) {
  return new Promise((resolve) => {
    const child = fork(path.join(__dirname, 'process-child.js'), [], {
      cwd: options.cwd || process.cwd(),
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      env: { ...process.env }
    });

    let settled = false;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* already exited */ }
      resolve(result);
    };

    child.once('message', (payload) => {
      if (payload && payload.ok) {
        settle(payload.result);
      } else {
        settle({
          file,
          tests: [{
            name: 'process',
            fullName: `${file} process`,
            status: 'failed',
            durationMs: 0,
            error: (payload && payload.error) || { message: 'process child returned no result', stack: '' }
          }]
        });
      }
    });

    child.once('error', (error) => {
      settle({
        file,
        tests: [{
          name: 'process',
          fullName: `${file} process`,
          status: 'failed',
          durationMs: 0,
          error: {
            message: String(error.message || error),
            stack: String(error.stack || error)
          }
        }]
      });
    });

    child.once('exit', (code) => {
      if (settled) return;
      const message = code === 0
        ? 'Child process exited before reporting test results'
        : `Child process exited with code ${code} before reporting test results`;
      settle({
        file,
        tests: [{
          name: 'process',
          fullName: `${file} process`,
          status: 'failed',
          durationMs: 0,
          error: { message, stack: message }
        }]
      });
    });

    child.send({
      file,
      match: options.match || null,
      allowedFullNames: Array.isArray(options.allowedFullNames) ? options.allowedFullNames : null,
      noMemes: Boolean(options.noMemes),
      updateContracts: Boolean(options.updateContracts),
      cwd: options.cwd || process.cwd(),
      environment: options.environment || 'node',
      setupFiles: Array.isArray(options.setupFiles) ? options.setupFiles : [],
      tsconfigPath: options.tsconfigPath === undefined ? undefined : options.tsconfigPath
    });
  });
}

function runFileInWorker(file, options = {}) {
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: {
        file,
        match: options.match || null,
        allowedFullNames: Array.isArray(options.allowedFullNames) ? options.allowedFullNames : null,
        noMemes: Boolean(options.noMemes),
        updateContracts: Boolean(options.updateContracts),
        cwd: options.cwd || process.cwd(),
        environment: options.environment || 'node',
        setupFiles: Array.isArray(options.setupFiles) ? options.setupFiles : [],
        tsconfigPath: options.tsconfigPath === undefined ? undefined : options.tsconfigPath
      }
    });

    let settled = false;

    const cleanup = () => {
      worker.removeListener('message', onMessage);
      worker.removeListener('error', onError);
      worker.removeListener('exit', onExit);
    };

    const settle = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const onMessage = (payload) => {
      if (payload.ok) {
        settle(payload.result);
      } else {
        settle({
          file,
          tests: [
            {
              name: 'worker',
              fullName: `${file} worker`,
              status: 'failed',
              durationMs: 0,
              error: payload.error
            }
          ]
        });
      }
    };

    const onError = (error) => {
      settle({
        file,
        tests: [
          {
            name: 'worker',
            fullName: `${file} worker`,
            status: 'failed',
            durationMs: 0,
            error: {
              message: String(error.message || error),
              stack: String(error.stack || error)
            }
          }
        ]
      });
    };

    const onExit = (code) => {
      if (settled) {
        return;
      }

      const normalizedCode = Number(code);
      const message = normalizedCode === 0
        ? 'Worker exited before reporting test results'
        : `Worker exited with code ${normalizedCode} before reporting test results`;

      settle({
        file,
        tests: [
          {
            name: 'worker',
            fullName: `${file} worker`,
            status: 'failed',
            durationMs: 0,
            error: {
              message,
              stack: message
            }
          }
        ]
      });
    };

    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
  });
}

async function runFileInProcess(file, options = {}) {
  const cacheKey = options.cache ? buildInProcessCacheKey(file, options) : null;
  if (cacheKey && inProcessResultCache.has(cacheKey)) {
    return cloneResult(inProcessResultCache.get(cacheKey));
  }

  const result = await collectAndRun(file, options);
  if (cacheKey) {
    inProcessResultCache.set(cacheKey, cloneResult(result));
  }
  return result;
}

function buildInProcessCacheKey(file, options) {
  const stats = fs.statSync(file);
  return JSON.stringify({
    file: path.resolve(file),
    size: stats.size,
    mtimeMs: Math.round(stats.mtimeMs),
    match: options.match || null,
    allowedFullNames: Array.isArray(options.allowedFullNames) ? options.allowedFullNames : null,
    noMemes: Boolean(options.noMemes),
    updateContracts: Boolean(options.updateContracts),
    cwd: options.cwd || process.cwd(),
    environment: options.environment || 'node',
    setupFiles: Array.isArray(options.setupFiles) ? options.setupFiles : [],
    tsconfigPath: options.tsconfigPath === undefined ? '__default__' : options.tsconfigPath
  });
}

function cloneResult(result) {
  return JSON.parse(JSON.stringify(result));
}

function clearRunCache() {
  inProcessResultCache.clear();
}

function resolveIsolationMode(options = {}) {
  if (options.isolation === 'in-process') return 'in-process';
  if (options.isolation === 'process') return 'process';
  return 'worker';
}

function resolveMaxWorkers(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

module.exports = {
  runTests,
  clearRunCache
};
