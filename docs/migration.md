# Migrating From Jest And Vitest

Themis is designed for incremental migration. Start by running existing suites under the Themis runtime, then convert touched tests toward native contracts and `intent(...)` flows as you work.

## Fast path

```bash
npx themis migrate jest
npx themis migrate jest --rewrite-imports
npx themis migrate jest --convert
npx themis test
```

Use `vitest` instead of `jest` for Vitest suites.

## Migration modes

- `themis migrate <jest|vitest>`: scaffold config, setup, compat bridge, and migration report.
- `--rewrite-imports`: point framework imports at `themis.compat.js`.
- `--convert`: remove common Jest/Vitest imports and rewrite common matcher/test patterns into Themis-native forms.

## Before And After

### 1. Runtime bridge first

Jest/Vitest:

```js
import { describe, test, expect } from '@jest/globals';

describe('math', () => {
  test('adds', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Themis after `migrate`:

```js
describe('math', () => {
  test('adds', () => {
    expect(1 + 1).toBe(2);
  });
});
```

The suite keeps running, but Themis owns the runner, artifacts, rerun loop, and agent payloads.

### 2. Matcher codemods

Jest/Vitest:

```js
import { it, expect } from '@jest/globals';

it('tracks calls', () => {
  const worker = fn();
  worker('ok');

  expect({ status: 'ok' }).toStrictEqual({ status: 'ok' });
  expect([1, 2]).toContainEqual(2);
  expect(worker).toBeCalledTimes(1);
});
```

Themis after `migrate --convert`:

```js
test('tracks calls', () => {
  const worker = fn();
  worker('ok');

  expect({ status: 'ok' }).toEqual({ status: 'ok' });
  expect([1, 2]).toContain(2);
  expect(worker).toHaveBeenCalledTimes(1);
});
```

### 3. Snapshot replacement

Jest/Vitest snapshot flow:

```js
test('renders summary', () => {
  const view = renderSummary();
  expect(view).toMatchSnapshot();
});
```

Themis contract flow:

```js
test('renders summary', () => {
  const view = renderSummary();

  captureContract('summary view', {
    heading: view.heading,
    counts: view.counts,
    flags: view.flags
  });

  expect(view.heading).toBe('Summary');
});
```

This keeps the baseline machine-readable and reviewable instead of hiding it in an opaque blob.

### 4. Better drift review

Jest/Vitest:

- large snapshot diffs
- broad “accept all changes” update flow

Themis:

- field-level diffs in `.themis/diffs/contract-diff.json`
- visible drift/update summaries in CLI and HTML reports
- explicit acceptance via `npx themis test --update-contracts --match "<regex>"`

### 5. Behavior-first UI coverage

Jest/Vitest often converges on DOM dumps or shallow expectations:

```js
test('button snapshot', () => {
  const { container } = render(<Button />);
  expect(container).toMatchSnapshot();
});
```

Themis pushes behavior and contract intent:

```js
test('button interaction contract', async () => {
  render(<Button />);

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  captureContract('button state', {
    text: screen.getByRole('button', { name: 'Saved' }).textContent
  });

  await waitFor(() => {
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});
```

## Showcase Examples

These are the strongest head-to-head examples to use when explaining why Themis is better for AI-agent loops:

1. Snapshot replacement: `captureContract(...)` plus `--update-contracts` gives baseline capture without snapshot churn.
2. Codemod migration: `themis migrate --convert` moves common Jest/Vitest matcher syntax toward native Themis without a manual rewrite pass.
3. Agent triage: `--agent`, `.themis/diffs/run-diff.json`, `.themis/runs/fix-handoff.json`, and `.themis/diffs/contract-diff.json` give machines structured rerun and repair inputs.
4. Human review: next reporter and HTML report now surface contract drift alongside failures, instead of burying meaning in raw output.
5. Generated coverage: `themis generate src` adds source-driven contract tests next to migrated suites, so adoption improves coverage instead of merely changing runners.

## Recommended rollout

1. Run `themis migrate <jest|vitest>`.
2. Add `--rewrite-imports` if you want local explicit compat imports.
3. Add `--convert` to normalize the easy matcher/import cases immediately.
4. Replace snapshots with `captureContract(...)` or explicit assertions in files you touch.
5. Use `themis generate src` to add source-driven coverage in parallel with migrated suites.
