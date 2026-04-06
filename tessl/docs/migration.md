# Themis Migration Reference

This reference expands the SKILL migration workflow from Jest or Vitest to Themis.

## Standard Sequence

1. Run `npx themis migrate <jest|vitest>`.
2. Run `npx themis test`.
3. If failing, run `npx themis test --rerun-failed`.
4. If failures reflect intended contract updates, run `npx themis test --update-contracts`.
5. Re-run `npx themis test` until stable.

## Workflow Intent

- Use built-in migration commands first.
- Avoid large manual rewrites before validating migrated behavior.
- Move touched files toward native Themis `intent(...)` and `test(...)` over time.

## Validation Artifacts

- `.themis/` contains framework-managed run and migration artifacts.
- `__themis__/reports/` contains report outputs used for debugging and recovery.

## After Migration

- Keep `.themis/`, `__themis__/reports/`, and `__themis__/shims/` gitignored.
- Keep authored/generated tests in `__themis__/tests`.
