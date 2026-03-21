const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectAndRun } = require('../src/runtime');

describe('intent DSL', () => {
  async function withFixture(source, run) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-intent-'));
    const fixturePath = path.join(tempDir, 'fixture.test.js');
    fs.writeFileSync(fixturePath, source, 'utf8');

    try {
      return await run({ tempDir, fixturePath });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  function firstTest(result) {
    expect(result.tests.length).toBe(1);
    return result.tests[0];
  }

  test('executes modern intent phases in deterministic order', async () => {
    await withFixture(
      `
const fs = require('fs');
const path = require('path');

intent('nlp pipeline', ({ context, run, verify, cleanup }) => {
  context('input utterance is available', (ctx) => {
    ctx.trace = ['context'];
    ctx.utterance = 'book a flight to nyc';
  });

  run('extract intent and entities', (ctx) => {
    ctx.trace.push('run');
    ctx.prediction = { intent: 'book_flight', city: 'nyc' };
  });

  verify('prediction matches expected output', (ctx) => {
    ctx.trace.push('verify');
    expect(ctx.prediction).toEqual({ intent: 'book_flight', city: 'nyc' });
  });

  cleanup('record execution trace', (ctx) => {
    ctx.trace.push('cleanup');
    fs.writeFileSync(path.join(__dirname, 'trace.json'), JSON.stringify(ctx.trace), 'utf8');
  });
});
`,
      async ({ tempDir, fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.status).toBe('passed');

        const tracePath = path.join(tempDir, 'trace.json');
        const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
        expect(trace).toEqual(['context', 'run', 'verify', 'cleanup']);
      }
    );
  });

  test('supports meme aliases as stable easter eggs', async () => {
    await withFixture(
      `
const fs = require('fs');
const path = require('path');

intent('meme phases', ({ cook, yeet, vibecheck, wipe }) => {
  cook('seed state', (ctx) => {
    ctx.trace = ['cook'];
    ctx.score = 40;
  });

  yeet('run transformation', (ctx) => {
    ctx.trace.push('yeet');
    ctx.score += 2;
  });

  vibecheck('score reaches 42', (ctx) => {
    ctx.trace.push('vibecheck');
    expect(ctx.score).toBe(42);
  });

  wipe('flush trace', (ctx) => {
    ctx.trace.push('wipe');
    fs.writeFileSync(path.join(__dirname, 'meme-trace.json'), JSON.stringify(ctx.trace), 'utf8');
  });
});
`,
      async ({ tempDir, fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.status).toBe('passed');

        const tracePath = path.join(tempDir, 'meme-trace.json');
        const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
        expect(trace).toEqual(['cook', 'yeet', 'vibecheck', 'wipe']);
      }
    );
  });

  test('can disable meme aliases with noMemes runtime option', async () => {
    await withFixture(
      `
intent('meme phases disabled', ({ cook, vibecheck }) => {
  cook('seed state', (ctx) => {
    ctx.score = 41;
  });

  vibecheck('score reaches 42', (ctx) => {
    expect(ctx.score + 1).toBe(42);
  });
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath, { noMemes: true });
        const testResult = firstTest(result);

        expect(testResult.name).toBe('load');
        expect(testResult.status).toBe('failed');
        expect(testResult.error.message).toContain('cook');
        expect(testResult.error.message).toContain('is not a function');
      }
    );
  });

  test('supports async phases', async () => {
    await withFixture(
      `
intent('async phases', ({ context, run, verify, cleanup }) => {
  context('create base signal', async (ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    ctx.score = 2;
  });

  run('compute intent score', async (ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    ctx.score = ctx.score * 3;
  });

  verify('score is finalized', async (ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(ctx.score).toBe(6);
  });

  cleanup('clear transient state', async (ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    delete ctx.score;
  });
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.status).toBe('passed');
      }
    );
  });

  test('rejects arrange declarations after act', async () => {
    await withFixture(
      `
intent('invalid order', ({ arrange, act, assert }) => {
  act('start processing', () => {});
  arrange('late setup', () => {});
  assert('noop check', () => {
    expect(true).toBe(true);
  });
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.name).toBe('load');
        expect(testResult.status).toBe('failed');
        expect(testResult.error.message).toContain('arrange(...) cannot be declared after act(...) or assert(...)');
      }
    );
  });

  test('rejects act declarations after assert', async () => {
    await withFixture(
      `
intent('invalid order', ({ act, assert }) => {
  assert('final check', () => {
    expect(true).toBe(true);
  });
  act('late action', () => {});
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.name).toBe('load');
        expect(testResult.status).toBe('failed');
        expect(testResult.error.message).toContain('act(...) cannot be declared after assert(...)');
      }
    );
  });

  test('requires at least one assert phase', async () => {
    await withFixture(
      `
intent('missing assert', ({ arrange, act }) => {
  arrange('setup', () => {});
  act('execute', () => {});
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.name).toBe('load');
        expect(testResult.status).toBe('failed');
        expect(testResult.error.message).toContain('must define at least one assert(...) phase');
      }
    );
  });

  test('runs cleanup even when an assert phase fails', async () => {
    await withFixture(
      `
const fs = require('fs');
const path = require('path');

intent('cleanup on failure', ({ arrange, assert, cleanup }) => {
  arrange('set marker path', (ctx) => {
    ctx.markerPath = path.join(__dirname, 'cleanup-ran.txt');
  });

  assert('force a failure', () => {
    expect(1).toBe(2);
  });

  cleanup('write cleanup marker', (ctx) => {
    fs.writeFileSync(ctx.markerPath, 'cleanup executed', 'utf8');
  });
});
`,
      async ({ tempDir, fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        const markerPath = path.join(tempDir, 'cleanup-ran.txt');

        expect(testResult.status).toBe('failed');
        expect(testResult.error.message).toContain('Intent phase failed: ASSERT force a failure');
        expect(fs.existsSync(markerPath)).toBe(true);
      }
    );
  });

  test('reports cleanup failure when run phases pass', async () => {
    await withFixture(
      `
intent('cleanup fails', ({ assert, cleanup }) => {
  assert('base check passes', () => {
    expect(true).toBe(true);
  });

  cleanup('teardown fails', () => {
    throw new Error('cleanup exploded');
  });
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.status).toBe('failed');
        expect(testResult.error.message).toContain('Intent phase failed: CLEANUP teardown fails');
        expect(testResult.error.message).toContain('cleanup exploded');
      }
    );
  });

  test('prioritizes run-phase failure over cleanup failure', async () => {
    await withFixture(
      `
intent('run failure wins', ({ assert, cleanup }) => {
  assert('run phase fails first', () => {
    throw new Error('run phase exploded');
  });

  cleanup('cleanup also fails', () => {
    throw new Error('cleanup exploded');
  });
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.status).toBe('failed');
        expect(testResult.error.message).toContain('Intent phase failed: ASSERT run phase fails first');
        expect(testResult.error.message).toContain('run phase exploded');
        expect(testResult.error.message.includes('CLEANUP cleanup also fails')).toBe(false);
      }
    );
  });

  test('auto-generates phase descriptions when omitted', async () => {
    await withFixture(
      `
intent('implicit phase description', ({ assert }) => {
  assert(() => {
    throw new Error('implicit assert exploded');
  });
});
`,
      async ({ fixturePath }) => {
        const result = await collectAndRun(fixturePath);
        const testResult = firstTest(result);
        expect(testResult.status).toBe('failed');
        expect(testResult.error.message).toContain('Intent phase failed: ASSERT assert phase 1');
        expect(testResult.error.message).toContain('implicit assert exploded');
      }
    );
  });
});
