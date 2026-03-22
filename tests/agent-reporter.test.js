const { printAgent } = require('../src/reporter');

describe('agent reporter', () => {
  function capturePayload(result) {
    const original = console.log;
    let output = '';
    console.log = (...args) => {
      output += `${args.join(' ')}\n`;
    };
    try {
      printAgent(result);
    } finally {
      console.log = original;
    }
    return JSON.parse(output.trim());
  }

  test('adds deterministic fingerprints and clustered failures', () => {
    const result = {
      meta: {
        startedAt: '2026-02-13T00:00:00.000Z',
        finishedAt: '2026-02-13T00:00:01.000Z',
        maxWorkers: 2
      },
      summary: {
        total: 4,
        passed: 1,
        failed: 3,
        skipped: 0,
        durationMs: 1000
      },
      files: [
        {
          file: '/tmp/a.test.js',
          tests: [
            {
              name: 'alpha',
              fullName: 'suite a > alpha',
              status: 'failed',
              durationMs: 10,
              error: {
                message: 'Boom   Went Bad\nline detail',
                stack: 'Error: Boom'
              }
            },
            {
              name: 'beta',
              fullName: 'suite a > beta',
              status: 'passed',
              durationMs: 5,
              error: null
            }
          ]
        },
        {
          file: '/tmp/b.test.js',
          tests: [
            {
              name: 'gamma',
              fullName: 'suite b > gamma',
              status: 'failed',
              durationMs: 12,
              error: {
                message: 'boom went bad',
                stack: 'Error: same root cause'
              }
            },
            {
              name: 'delta',
              fullName: 'suite b > delta',
              status: 'failed',
              durationMs: 8,
              error: {
                message: 'different failure',
                stack: 'Error: different'
              }
            }
          ]
        }
      ]
    };

    const payload = capturePayload(result);
    expect(payload.analysis.fingerprintVersion).toBe('fnv1a32-message-v1');
    expect(payload.failures.length).toBe(3);
    expect(payload.analysis.failureClusters.length).toBe(2);
    expect(payload.analysis.stability.runs).toBe(1);
    expect(payload.analysis.stability.summary.stablePass).toBe(1);
    expect(payload.analysis.stability.summary.stableFail).toBe(3);
    expect(payload.analysis.stability.summary.unstable).toBe(0);
    expect(payload.analysis.comparison.status).toBe('baseline');
    expect(payload.analysis.comparison.newFailures).toHaveLength(3);
    expect(payload.artifacts.runDiff).toBe('.themis/run-diff.json');
    expect(payload.artifacts.fixHandoff).toBe('.themis/fix-handoff.json');
    expect(payload.hints.updateSnapshots).toBe('npx themis test -u');
    expect(payload.hints.repairGenerated).toBe('cat .themis/fix-handoff.json');

    const byName = {};
    for (const failure of payload.failures) {
      byName[failure.fullName] = failure;
      expect(failure.fingerprint.startsWith('f1-')).toBe(true);
    }

    expect(byName['suite a > alpha'].fingerprint).toBe(byName['suite b > gamma'].fingerprint);
    expect(byName['suite b > delta'].fingerprint === byName['suite a > alpha'].fingerprint).toBe(false);

    const topCluster = payload.analysis.failureClusters[0];
    expect(topCluster.count).toBe(2);
    expect(topCluster.message).toBe('boom went bad');
    expect(topCluster.tests).toEqual(['suite a > alpha', 'suite b > gamma']);
  });
});
