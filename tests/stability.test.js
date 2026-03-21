const { buildStabilityReport, hasStabilityBreaches } = require('../src/stability');

describe('stability analysis', () => {
  test('classifies stable pass, stable fail, and unstable cases', () => {
    const runResults = [
      {
        files: [
          {
            file: '/tmp/a.test.js',
            tests: [
              { name: 'p', fullName: 'suite > p', status: 'passed' },
              { name: 'f', fullName: 'suite > f', status: 'failed' },
              { name: 'u', fullName: 'suite > u', status: 'passed' }
            ]
          }
        ]
      },
      {
        files: [
          {
            file: '/tmp/a.test.js',
            tests: [
              { name: 'p', fullName: 'suite > p', status: 'passed' },
              { name: 'f', fullName: 'suite > f', status: 'failed' },
              { name: 'u', fullName: 'suite > u', status: 'failed' }
            ]
          }
        ]
      }
    ];

    const report = buildStabilityReport(runResults);
    expect(report.runs).toBe(2);
    expect(report.summary.stablePass).toBe(1);
    expect(report.summary.stableFail).toBe(1);
    expect(report.summary.unstable).toBe(1);
    expect(hasStabilityBreaches(report)).toBe(true);
  });

  test('marks missing results as unstable', () => {
    const runResults = [
      {
        files: [
          {
            file: '/tmp/a.test.js',
            tests: [
              { name: 'x', fullName: 'suite > x', status: 'passed' }
            ]
          }
        ]
      },
      {
        files: [
          {
            file: '/tmp/a.test.js',
            tests: []
          }
        ]
      }
    ];

    const report = buildStabilityReport(runResults);
    expect(report.tests.length).toBe(1);
    expect(report.tests[0].statuses).toEqual(['passed', 'missing']);
    expect(report.tests[0].classification).toBe('unstable');
  });
});
