const { collectAndRun } = require('./runtime');

process.once('message', async (workerData) => {
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
    process.send({ ok: true, result }, () => process.exit(0));
  } catch (error) {
    process.send({
      ok: false,
      error: {
        message: String((error && error.message) || error),
        stack: String((error && error.stack) || error)
      }
    }, () => process.exit(0));
  }
});
