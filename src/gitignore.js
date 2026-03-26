const fs = require('fs');
const path = require('path');

function ensureGitignoreEntries(cwd, entries) {
  const targetPath = path.join(cwd, '.gitignore');
  const requestedEntries = [...new Set(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  )];

  if (requestedEntries.length === 0) {
    return {
      path: targetPath,
      updated: false
    };
  }

  const existing = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, 'utf8')
    : '';
  const normalized = existing.replace(/\r\n/g, '\n');
  const existingEntries = new Set(
    normalized
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );
  const missingEntries = requestedEntries.filter((entry) => !existingEntries.has(entry));

  if (missingEntries.length === 0) {
    return {
      path: targetPath,
      updated: false
    };
  }

  let nextSource = normalized;
  if (nextSource.length > 0 && !nextSource.endsWith('\n')) {
    nextSource += '\n';
  }
  nextSource += `${missingEntries.join('\n')}\n`;
  fs.writeFileSync(targetPath, nextSource, 'utf8');

  return {
    path: targetPath,
    updated: true
  };
}

module.exports = {
  ensureGitignoreEntries
};
