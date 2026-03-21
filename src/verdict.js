async function verdictReveal(options = {}) {
  const {
    ok = true,
    stream = process.stdout,
    title = 'VERDICT',
    detail = ok ? 'TRUTH UPHELD' : 'TRUTH VIOLATED',
    delayMs = 120
  } = options;

  if (!canReveal(stream)) {
    return;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frames = ok
    ? [
        '⚖️  [=    ]',
        '⚖️  [==   ]',
        '⚖️  [===  ]',
        '⚖️  [==== ]',
        '⚖️  [=====]'
      ]
    : [
        '⚖️  [==== ]',
        '⚖️  [===  ]',
        '⚖️  [==   ]',
        '⚖️  [=    ]',
        '⚖️  [     ]'
      ];

  const waitMs = normalizeDelay(delayMs);

  stream.write('\x1B[?25l');
  try {
    for (const frame of frames) {
      stream.write(`\r${frame}  ${title}`);
      await sleep(waitMs);
    }
    stream.write(`\r${ok ? '✔' : '✖'}  ${title}: ${detail}\n`);
  } finally {
    stream.write('\x1B[?25h');
  }
}

function canReveal(stream) {
  if (!stream || typeof stream.write !== 'function') {
    return false;
  }
  if (!stream.isTTY) {
    return false;
  }
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.THEMIS_NO_REVEAL === '1') {
    return false;
  }
  return true;
}

function normalizeDelay(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 120;
  }
  return parsed;
}

module.exports = {
  verdictReveal
};
