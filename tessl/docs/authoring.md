# Themis Authoring Reference

This reference expands the core SKILL guidance for writing Themis-native unit tests.

## Constructs

- `intent(...)`: behavior/workflow tests with ordered phases.
- `test(...)`: low-level pure-unit checks.
- intent phases:
  - preferred: `context`, `run`, `verify`, optional `cleanup`
  - legacy aliases: `arrange`, `act`, `assert`

## File Placement

- Keep generated and authored test files under `__themis__/tests` in downstream repositories.
- Treat `.themis/` as framework-managed artifacts.

## Authoring Pattern

```ts
/// <reference types="@vitronai/themis/globals" />

intent("behavior example", ({ context, run, assert }) => {
  context("setup", (ctx) => {
    ctx.value = 2;
  });

  run("execute", (ctx) => {
    ctx.result = Number(ctx.value) + 1;
  });

  assert("verify", (ctx) => {
    if (ctx.result !== 3) {
      throw new Error(`Expected 3, got ${String(ctx.result)}`);
    }
  });
});

test("unit example", () => {
  const actual = "a".toUpperCase();
  if (actual !== "A") {
    throw new Error(`Expected A, got ${actual}`);
  }
});
```

## Guardrails

- Do not use Jest/Vitest primitives in newly authored Themis tests:
  - `describe`, `it`, `expect`, `jest`, `vi`, `@jest/globals`
- Prefer direct, deterministic assertions and avoid nondeterministic time/network behavior unless mocked.
