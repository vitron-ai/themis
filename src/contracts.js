const fs = require('fs');
const path = require('path');
const util = require('util');

const CONTRACT_ARTIFACT_DIR = path.join('.themis', 'contracts');

function createContractHarness(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const getCurrentTest = typeof options.getCurrentTest === 'function'
    ? options.getCurrentTest
    : () => null;
  const updateContracts = Boolean(options.updateContracts);
  const events = [];

  function captureContract(name, value, contractOptions = {}) {
    const currentTest = getCurrentTest();
    if (!currentTest || !currentTest.fullName) {
      throw new Error('captureContract(...) is only available while a Themis test is running');
    }

    const contractName = String(name || '').trim();
    if (!contractName) {
      throw new Error('captureContract(...) requires a non-empty contract name');
    }

    const normalizedValue = applyContractOptions(value, contractOptions);
    const contractKey = buildContractKey(currentTest, contractName);
    const relativeFile = contractOptions.file
      ? normalizeRelativeContractPath(contractOptions.file)
      : path.join(CONTRACT_ARTIFACT_DIR, `${contractKey}.json`).split(path.sep).join('/');
    const absoluteFile = path.join(cwd, relativeFile);
    const previous = readExistingContract(absoluteFile);
    const diff = previous.exists
      ? createContractDiff(previous.value, normalizedValue)
      : createCreatedContractDiff(normalizedValue);

    let status = 'unchanged';
    if (!previous.exists) {
      status = 'created';
      ensureContractDirectory(absoluteFile);
      fs.writeFileSync(absoluteFile, `${JSON.stringify(normalizedValue, null, 2)}\n`, 'utf8');
    } else if (!diff.equal && updateContracts) {
      status = 'updated';
      ensureContractDirectory(absoluteFile);
      fs.writeFileSync(absoluteFile, `${JSON.stringify(normalizedValue, null, 2)}\n`, 'utf8');
    } else if (!diff.equal) {
      status = 'drifted';
    }

    const event = {
      key: contractKey,
      name: contractName,
      status,
      contractFile: relativeFile,
      file: currentTest.file,
      testName: currentTest.name,
      fullName: currentTest.fullName,
      updateCommand: `npx themis test --update-contracts --match ${JSON.stringify(currentTest.fullName)}`,
      diff
    };
    events.push(event);

    if (status === 'drifted') {
      throw new Error(
        `Contract "${contractName}" drifted for ${currentTest.fullName}. ` +
        `Review ${relativeFile} and rerun with --update-contracts to accept the new contract.\n` +
        formatContractDiff(diff)
      );
    }

    return normalizedValue;
  }

  return {
    captureContract,
    getEvents() {
      return events.map((event) => JSON.parse(JSON.stringify(event)));
    }
  };
}

function normalizeContractValue(value) {
  if (value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (value === undefined) {
    return '[undefined]';
  }
  if (typeof value === 'bigint') {
    return `${value}n`;
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }
  if (typeof value === 'symbol') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return {
      type: 'Buffer',
      data: value.toString('base64')
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeContractValue(entry));
  }
  if (value instanceof Map) {
    return [...value.entries()]
      .map(([key, entryValue]) => [normalizeContractValue(key), normalizeContractValue(entryValue)])
      .sort(compareContractEntries);
  }
  if (value instanceof Set) {
    return [...value.values()]
      .map((entry) => normalizeContractValue(entry))
      .sort(compareNormalizedValues);
  }
  if (value && typeof value === 'object') {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeContractValue(value[key]);
    }
    return normalized;
  }
  return String(value);
}

function applyContractOptions(value, contractOptions = {}) {
  let nextValue = typeof contractOptions.normalize === 'function'
    ? contractOptions.normalize(value)
    : value;

  nextValue = normalizeContractValue(nextValue);

  if (Array.isArray(contractOptions.maskPaths) && contractOptions.maskPaths.length > 0) {
    nextValue = maskContractPaths(nextValue, contractOptions.maskPaths);
  }

  if (contractOptions.sortArrays) {
    nextValue = sortNormalizedArrays(nextValue);
  }

  return nextValue;
}

function compareContractEntries(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function compareNormalizedValues(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function normalizeRelativeContractPath(filePath) {
  const normalized = String(filePath || '').split(path.sep).join('/');
  if (!normalized.startsWith('.themis/')) {
    return path.join(CONTRACT_ARTIFACT_DIR, normalized).split(path.sep).join('/');
  }
  return normalized;
}

function buildContractKey(test, name) {
  const parts = [test.file, test.fullName, name]
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(' ');
  return slugify(parts);
}

function slugify(value) {
  const slug = String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
  return slug || 'contract';
}

function ensureContractDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readExistingContract(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      value: null
    };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return {
      exists: true,
      value: JSON.parse(raw)
    };
  } catch (error) {
    throw new Error(`Failed to parse existing contract at ${filePath}: ${String(error.message || error)}`);
  }
}

function createCreatedContractDiff(nextValue) {
  const flat = flattenContractValue(nextValue);
  return {
    equal: false,
    added: flat.slice(0, 12).map((entry) => ({ path: entry.path, after: entry.value })),
    removed: [],
    changed: [],
    unchangedCount: 0
  };
}

function createContractDiff(previousValue, nextValue) {
  const previousFlat = flattenContractValue(previousValue);
  const nextFlat = flattenContractValue(nextValue);
  const previousMap = new Map(previousFlat.map((entry) => [entry.path, entry.value]));
  const nextMap = new Map(nextFlat.map((entry) => [entry.path, entry.value]));
  const allPaths = [...new Set([...previousMap.keys(), ...nextMap.keys()])].sort();
  const added = [];
  const removed = [];
  const changed = [];
  let unchangedCount = 0;

  for (const entryPath of allPaths) {
    const hasPrevious = previousMap.has(entryPath);
    const hasNext = nextMap.has(entryPath);
    if (!hasPrevious && hasNext) {
      added.push({ path: entryPath, after: nextMap.get(entryPath) });
      continue;
    }
    if (hasPrevious && !hasNext) {
      removed.push({ path: entryPath, before: previousMap.get(entryPath) });
      continue;
    }
    const before = previousMap.get(entryPath);
    const after = nextMap.get(entryPath);
    if (util.isDeepStrictEqual(before, after)) {
      unchangedCount += 1;
      continue;
    }
    changed.push({ path: entryPath, before, after });
  }

  return {
    equal: added.length === 0 && removed.length === 0 && changed.length === 0,
    added: added.slice(0, 12),
    removed: removed.slice(0, 12),
    changed: changed.slice(0, 12),
    unchangedCount
  };
}

function flattenContractValue(value, currentPath = '$') {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [{ path: currentPath, value: [] }];
    }
    return value.flatMap((entry, index) => flattenContractValue(entry, `${currentPath}[${index}]`));
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return [{ path: currentPath, value: {} }];
    }
    return keys.flatMap((key) => flattenContractValue(value[key], `${currentPath}.${key}`));
  }
  return [{ path: currentPath, value }];
}

function formatContractDiff(diff) {
  const lines = [];
  for (const entry of diff.changed.slice(0, 4)) {
    lines.push(`changed ${entry.path}: ${formatValue(entry.before)} -> ${formatValue(entry.after)}`);
  }
  for (const entry of diff.added.slice(0, 4)) {
    lines.push(`added ${entry.path}: ${formatValue(entry.after)}`);
  }
  for (const entry of diff.removed.slice(0, 4)) {
    lines.push(`removed ${entry.path}: ${formatValue(entry.before)}`);
  }
  return lines.join('\n');
}

function maskContractPaths(value, maskPaths) {
  const targets = new Set(maskPaths.map((entry) => String(entry)));
  return visitContractValue(value, '$', (currentValue, currentPath) => {
    if (targets.has(currentPath)) {
      return '[masked]';
    }
    return currentValue;
  });
}

function sortNormalizedArrays(value) {
  return visitContractValue(value, '$', (currentValue) => {
    if (!Array.isArray(currentValue)) {
      return currentValue;
    }
    return [...currentValue].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  });
}

function visitContractValue(value, currentPath, visitor) {
  if (Array.isArray(value)) {
    const mapped = value.map((entry, index) => visitContractValue(entry, `${currentPath}[${index}]`, visitor));
    return visitor(mapped, currentPath);
  }
  if (value && typeof value === 'object') {
    const mapped = {};
    for (const key of Object.keys(value)) {
      mapped[key] = visitContractValue(value[key], `${currentPath}.${key}`, visitor);
    }
    return visitor(mapped, currentPath);
  }
  return visitor(value, currentPath);
}

function formatValue(value) {
  return util.inspect(value, { depth: 4, colors: false, maxArrayLength: 10 });
}

module.exports = {
  CONTRACT_ARTIFACT_DIR,
  createContractHarness,
  createContractDiff,
  formatContractDiff,
  normalizeContractValue
};
