describe('intent DSL typings', () => {
  const modernConfig: import('..').ThemisConfig = {
    testDir: 'tests',
    generatedTestsDir: '__themis__/tests',
    testRegex: '\\.(test|spec)\\.(js|jsx|ts|tsx)$',
    maxWorkers: 2,
    reporter: 'next',
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    tsconfigPath: 'tsconfig.json',
    htmlReportPath: '__themis__/reports/report.html',
    testIgnore: ['^tests/fixtures(?:/|$)']
  };

  const modernRunOptions: import('..').RunOptions = {
    environment: modernConfig.environment,
    setupFiles: modernConfig.setupFiles,
    tsconfigPath: modernConfig.tsconfigPath,
    cwd: '/tmp/themis-project'
  };

  expect(modernRunOptions.environment).toBe('jsdom');

  const typedMock = fn((value: number) => value + 1);
  typedMock.mockReturnValue(4);
  typedMock.mockImplementation((value) => value + 2);
  mock('./dependency', () => ({ run: typedMock }));
  unmock('./dependency');

  intent<{ utterance: string; score: number }>('typed context', ({ context, run, verify, cleanup }) => {
    context('initialize context', (ctx) => {
      ctx.utterance = 'book a flight';
      ctx.score = 0;
    });

    run('mutate state', (ctx) => {
      ctx.score += 1;
    });

    verify('type-safe access', (ctx) => {
      expect(ctx.utterance).toContain('flight');
      expect(ctx.score).toBe(1);
    });

    cleanup('reset score', (ctx) => {
      ctx.score = 0;
    });
  });

  intent<{ score: number }>('compile-time guard', ({ context, verify }) => {
    context('disallow wrong assignment', (ctx) => {
      // @ts-expect-error score must stay numeric
      ctx.score = 'wrong';
    });

    verify('score remains numeric', (ctx) => {
      expect(ctx.score).toBe(0);
    });
  });

  intent<{ score: number }>('meme aliases are typed', ({ cook, yeet, vibecheck, wipe }) => {
    cook('seed score', (ctx) => {
      ctx.score = 1;
    });

    yeet('increment score', (ctx) => {
      ctx.score += 1;
    });

    vibecheck('score is numeric', (ctx) => {
      expect(ctx.score).toBe(2);
    });

    wipe('reset score', (ctx) => {
      ctx.score = 0;
    });
  });
});
