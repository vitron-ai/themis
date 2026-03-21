function buildStabilityReport(runResults) {
  if (!Array.isArray(runResults) || runResults.length === 0) {
    return {
      runs: 0,
      summary: {
        stablePass: 0,
        stableFail: 0,
        unstable: 0
      },
      tests: []
    };
  }

  const runCount = runResults.length;
  const byKey = new Map();

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    const result = runResults[runIndex] || {};
    const files = Array.isArray(result.files) ? result.files : [];
    for (const file of files) {
      const tests = Array.isArray(file.tests) ? file.tests : [];
      for (const test of tests) {
        if (test.status === 'skipped') {
          continue;
        }

        const key = `${file.file}::${test.fullName}`;
        let entry = byKey.get(key);
        if (!entry) {
          entry = {
            file: file.file,
            testName: test.name,
            fullName: test.fullName,
            statuses: new Array(runCount).fill('missing')
          };
          byKey.set(key, entry);
        }
        entry.statuses[runIndex] = test.status;
      }
    }
  }

  const tests = [...byKey.values()].map((entry) => {
    const classification = classifyStability(entry.statuses);
    return {
      file: entry.file,
      testName: entry.testName,
      fullName: entry.fullName,
      statuses: entry.statuses,
      classification
    };
  });

  tests.sort((a, b) => {
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare !== 0) {
      return fileCompare;
    }
    return a.fullName.localeCompare(b.fullName);
  });

  const summary = {
    stablePass: tests.filter((entry) => entry.classification === 'stable_pass').length,
    stableFail: tests.filter((entry) => entry.classification === 'stable_fail').length,
    unstable: tests.filter((entry) => entry.classification === 'unstable').length
  };

  return {
    runs: runCount,
    summary,
    tests
  };
}

function classifyStability(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return 'unstable';
  }
  if (statuses.every((status) => status === 'passed')) {
    return 'stable_pass';
  }
  if (statuses.every((status) => status === 'failed')) {
    return 'stable_fail';
  }
  return 'unstable';
}

function hasStabilityBreaches(report) {
  if (!report || !report.summary) {
    return false;
  }
  return report.summary.stableFail > 0 || report.summary.unstable > 0;
}

module.exports = {
  buildStabilityReport,
  hasStabilityBreaches
};
