const fs = require('fs');
const path = require('path');
const util = require('util');

function createSnapshotState(filePath, options = {}) {
  const snapshotDir = path.join(path.dirname(filePath), '__snapshots__');
  const snapshotFile = path.join(snapshotDir, `${path.basename(filePath)}.snapshots.json`);
  const existing = readSnapshotFile(snapshotFile);
  const nextSnapshots = { ...existing };
  const counters = new Map();
  let dirty = false;
  let currentTestName = null;

  return {
    setCurrentTestName(testName) {
      currentTestName = testName;
    },
    clearCurrentTestName() {
      currentTestName = null;
    },
    matchSnapshot(received, snapshotName) {
      if (!currentTestName) {
        throw new Error('toMatchSnapshot() must be called while a test is running');
      }

      const baseKey = snapshotName
        ? `${currentTestName}: ${String(snapshotName)}`
        : currentTestName;
      const nextIndex = (counters.get(baseKey) || 0) + 1;
      counters.set(baseKey, nextIndex);
      const snapshotKey = nextIndex === 1 ? baseKey : `${baseKey} (${nextIndex})`;
      const serialized = serializeSnapshot(received);

      if (!Object.prototype.hasOwnProperty.call(existing, snapshotKey)) {
        nextSnapshots[snapshotKey] = serialized;
        dirty = true;
        return;
      }

      if (existing[snapshotKey] !== serialized) {
        if (options.updateSnapshots) {
          nextSnapshots[snapshotKey] = serialized;
          dirty = true;
          return;
        }

        throw new Error(
          `Snapshot mismatch for ${snapshotKey}\n\nExpected:\n${existing[snapshotKey]}\n\nReceived:\n${serialized}`
        );
      }
    },
    save() {
      if (!dirty) {
        return null;
      }

      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(snapshotFile, `${JSON.stringify(nextSnapshots, null, 2)}\n`, 'utf8');
      return snapshotFile;
    },
    path: snapshotFile
  };
}

function readSnapshotFile(snapshotFile) {
  if (!fs.existsSync(snapshotFile)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
}

function serializeSnapshot(value) {
  if (typeof value === 'string') {
    return value;
  }

  return util.inspect(value, {
    depth: 20,
    colors: false,
    sorted: true,
    compact: false,
    breakLength: 80,
    maxArrayLength: null
  });
}

module.exports = {
  createSnapshotState
};
