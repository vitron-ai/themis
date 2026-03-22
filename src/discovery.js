const fs = require('fs');
const path = require('path');

function discoverTests(cwd, config) {
  const start = path.resolve(cwd, config.testDir);
  const regex = new RegExp(config.testRegex);
  const ignored = compileIgnorePatterns(config.testIgnore);
  const files = [];

  if (!fs.existsSync(start)) {
    return files;
  }

  walk(start, regex, ignored, files, cwd);
  return files.sort();
}

function walk(dir, regex, ignored, files, cwd) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    const relativePath = normalizeRelativePath(cwd, fullPath);
    if (shouldIgnore(relativePath, entry.isDirectory(), ignored)) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(fullPath, regex, ignored, files, cwd);
      continue;
    }
    if (entry.isFile() && regex.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

function compileIgnorePatterns(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return [];
  }

  return patterns.map((pattern) => new RegExp(pattern));
}

function normalizeRelativePath(cwd, fullPath) {
  return path.relative(cwd, fullPath).split(path.sep).join('/');
}

function shouldIgnore(relativePath, isDirectory, ignored) {
  if (!Array.isArray(ignored) || ignored.length === 0) {
    return false;
  }

  const candidates = isDirectory
    ? [relativePath, `${relativePath}/`]
    : [relativePath];

  return candidates.some((candidate) => ignored.some((pattern) => pattern.test(candidate)));
}

module.exports = { discoverTests };
