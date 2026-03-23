const { parentPort, workerData } = require('worker_threads');
const { collectAndRun } = require('./runtime');

(async () => {
  try {
    const result = await collectAndRun(workerData.file, {
      match: workerData.match,
      allowedFullNames: workerData.allowedFullNames,
      noMemes: workerData.noMemes,
      updateContracts: workerData.updateContracts,
      cwd: workerData.cwd,
      environment: workerData.environment,
      setupFiles: workerData.setupFiles,
      tsconfigPath: workerData.tsconfigPath
    });
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: {
        message: String(error?.message || error),
        stack: String(error?.stack || error)
      }
    });
  }
})();
