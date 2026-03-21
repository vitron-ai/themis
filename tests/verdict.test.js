const { verdictReveal } = require('../src/verdict');

describe('verdict reveal', () => {
  function createStream(isTTY) {
    let output = '';
    return {
      isTTY,
      write(chunk) {
        output += String(chunk);
      },
      read() {
        return output;
      }
    };
  }

  test('renders progressive success frames and final success line', async () => {
    const stream = createStream(true);
    const previousNoColor = process.env.NO_COLOR;
    const previousNoReveal = process.env.THEMIS_NO_REVEAL;
    delete process.env.NO_COLOR;
    delete process.env.THEMIS_NO_REVEAL;

    try {
      await verdictReveal({
        ok: true,
        stream,
        title: 'THEMIS VERDICT',
        detail: 'TRUTH UPHELD',
        delayMs: 0
      });
    } finally {
      process.env.NO_COLOR = previousNoColor;
      process.env.THEMIS_NO_REVEAL = previousNoReveal;
    }

    const output = stream.read();
    expect(output.includes('\x1B[?25l')).toBe(true);
    expect(output.includes('\x1B[?25h')).toBe(true);
    expect(output.includes('⚖️  [=====]  THEMIS VERDICT')).toBe(true);
    expect(output.includes('✔  THEMIS VERDICT: TRUTH UPHELD')).toBe(true);
  });

  test('skips reveal when stream is not tty', async () => {
    const stream = createStream(false);
    await verdictReveal({
      ok: false,
      stream,
      title: 'THEMIS VERDICT',
      detail: 'TRUTH VIOLATED',
      delayMs: 0
    });

    expect(stream.read()).toBe('');
  });
});
