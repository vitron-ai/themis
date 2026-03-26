# Showcase Comparisons

These examples are the clearest proof of where Themis should beat Jest and Vitest for AI-agent-heavy JS/TS test loops.

## 1. Replace snapshots with contract capture

Jest/Vitest snapshot flow:

```ts
test('banner state', () => {
  expect(renderBanner(model)).toMatchSnapshot();
});
```

Themis contract flow:

```ts
test('banner state', () => {
  captureContract('banner state', {
    title: renderBanner(model).title,
    actions: renderBanner(model).actions
  }, {
    maskPaths: ['$.requestId'],
    sortArrays: true
  });
});
```

Why it wins:

- captures only the fields that matter
- masks volatile IDs and timestamps instead of accepting noisy churn
- writes machine-readable drift to `.themis/contract-diff.json`
- updates stay explicit with `npx themis test --update-contracts`

## 2. Migrate Jest/Vitest suites without a rewrite freeze

Starting suite:

```ts
import { describe, it, expect } from '@jest/globals';

describe('worker', () => {
  it('records calls', () => {
    const fnRef = fn();
    fnRef('ok');
    expect(fnRef).toBeCalledTimes(1);
    expect({ status: 'ok' }).toStrictEqual({ status: 'ok' });
  });
});
```

After `npx themis migrate jest --convert`:

```ts
describe('worker', () => {
  test('records calls', () => {
    const fnRef = fn();
    fnRef('ok');
    expect(fnRef).toHaveBeenCalledTimes(1);
    expect({ status: 'ok' }).toEqual({ status: 'ok' });
  });
});
```

Why it wins:

- removes common compatibility imports
- rewrites common matcher aliases into native Themis forms
- emits `.themis/migration-report.json` so agents and humans can track what changed

## 3. Give agents a repair loop humans can still read

Jest/Vitest mostly produce console text plus optional snapshots.

Themis produces:

- `.themis/failed-tests.json`
- `.themis/run-diff.json`
- `.themis/fix-handoff.json`
- `.themis/contract-diff.json`

Why it wins:

- agents get deterministic machine-readable artifacts
- humans still get focused CLI and HTML diffs
- rerun, repair, and acceptance loops are explicit instead of buried in terminal logs

## 4. Keep local loops fast without losing determinism

Themis local loop:

```bash
npx themis test --watch --isolation in-process --cache --reporter next
```

Why it wins:

- optimized for short edit-rerun-review cycles
- preserves canonical JSON and artifact contracts
- keeps failure diffs and contract drift visible while iterating

## 5. Surface migration and contract work directly in VS Code

Themis sidebar groups:

- `Contract Review`
- `Migration Review`
- `Failures`
- `Generated Review`

Why it wins:

- the editor reads artifact contracts instead of reimplementing runner logic
- one action accepts reviewed contracts
- one action reruns migration codemods for the detected framework
- humans and agents operate from the same source of truth

## 6. Show native Themis React tests beside Jest and Vitest in CI

CI now carries three explicit React showcase jobs:

- `Themis React Showcase`
- `Jest React Showcase`
- `Vitest React Showcase`

The Themis fixture is a straight-up native Themis jsdom suite. The Jest and Vitest fixtures cover the same interaction and async status scenarios with their own runner-native APIs.

Why it wins:

- the CI page makes the runner comparison obvious instead of implied
- the repo now has a first-party native Themis React example, not only migration proof
- humans and agents can inspect checked-in fixture sources under `tests/fixtures/showcase/`
