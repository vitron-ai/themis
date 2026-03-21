const path = require('path');
const { Worker } = require('worker_threads');
const { performance } = require('perf_hooks');

async function runTests(files, options = {}) {
  const startedAt = performance.now();
  const startedAtIso = new Date().toISOString();
  const maxWorkers = resolveMaxWorkers(options.maxWorkers);
  const queue = [...files];
  const workers = [];
  const fileResults = [];

  for (let i = 0; i < Math.min(maxWorkers, files.length); i += 1) {
    workers.push(runNext(queue, fileResults, options));
  }

  await Promise.all(workers);

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

function runFileInWorker(file, options = {}) {
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: {
        file,
        match: options.match || null,
        allowedFullNames: Array.isArray(options.allowedFullNames) ? options.allowedFullNames : null,
        noMemes: Boolean(options.noMemes),
        cwd: options.cwd || process.cwd(),
        environment: options.environment || 'node',
        setupFiles: Array.isArray(options.setupFiles) ? options.setupFiles : [],
        tsconfigPath: options.tsconfigPath === undefined ? undefined : options.tsconfigPath,
        updateSnapshots: Boolean(options.updateSnapshots)
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

function resolveMaxWorkers(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

module.exports = {
  runTests
};
