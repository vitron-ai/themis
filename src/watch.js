const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const WATCHABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.mjs', '.cjs', '.mts', '.cts']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.themis']);

function stripWatchFlags(args) {
  return args.filter((token) => token !== '--watch' && token !== '-w');
}

function collectWatchSignature(cwd) {
  const entries = [];
  walkWatchTree(path.resolve(cwd), entries);
  return entries.sort();
}

function hasWatchSignatureChanged(previousSignature, nextSignature) {
  if (previousSignature.length !== nextSignature.length) {
    return true;
  }

  for (let i = 0; i < previousSignature.length; i += 1) {
    if (previousSignature[i] !== nextSignature[i]) {
      return true;
    }
  }

  return false;
}

async function runWatchMode(options) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const cliArgs = stripWatchFlags(options.cliArgs || []);
  const cliPath = path.join(__dirname, '..', 'bin', 'themis.js');
  const pollIntervalMs = Number(options.pollIntervalMs) > 0 ? Number(options.pollIntervalMs) : 400;
  let previousSignature = collectWatchSignature(cwd);
  let running = false;
  let stopped = false;
  let intervalId = null;
  let activeChild = null;
  let resolveStop = null;
  const stopPromise = new Promise((resolve) => {
    resolveStop = resolve;
  });

  const runOnce = () => new Promise((resolve, reject) => {
    activeChild = spawn(process.execPath, [cliPath, 'test', ...cliArgs], {
      cwd,
      stdio: 'inherit',
      env: process.env
    });

    let settled = false;
    const finish = (handler) => (value) => {
      if (settled) {
        return;
      }
      settled = true;
      activeChild = null;
      handler(value);
      if (stopped && resolveStop) {
        resolveStop();
      }
    };

    activeChild.once('error', finish(reject));
    activeChild.once('exit', () => {
      finish(resolve)();
    });
  });

  const shutdown = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);

    if (activeChild && !activeChild.killed) {
      activeChild.kill('SIGINT');
    } else if (resolveStop) {
      resolveStop();
    }

    process.stdout.write('\nWatch mode stopped.\n');
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await runOnce();
  process.stdout.write('\nWatching for changes...\n');

  intervalId = setInterval(async () => {
    if (running || stopped) {
      return;
    }

    const nextSignature = collectWatchSignature(cwd);
    if (!hasWatchSignatureChanged(previousSignature, nextSignature)) {
      return;
    }

    previousSignature = nextSignature;
    running = true;
    process.stdout.write('\nChange detected. Re-running...\n');
    await runOnce();
    process.stdout.write('\nWatching for changes...\n');
    running = false;
  }, pollIntervalMs);

  await stopPromise;
}

function walkWatchTree(dir, entries) {
  const dirEntries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of dirEntries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || entry.name === '__snapshots__') {
        continue;
      }
      walkWatchTree(path.join(dir, entry.name), entries);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (!WATCHABLE_EXTENSIONS.has(extension)) {
      continue;
    }

    const targetPath = path.join(dir, entry.name);
    const stats = fs.statSync(targetPath);
    entries.push(`${targetPath}:${Math.round(stats.mtimeMs)}:${stats.size}`);
  }
}

module.exports = {
  collectWatchSignature,
  hasWatchSignatureChanged,
  runWatchMode,
  stripWatchFlags
};
