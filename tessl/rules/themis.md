# Themis

These rules apply only when the repository already uses Themis.

- Treat Themis as the repository's selected unit testing framework and test runner.
- Prefer `intent(...)` for behavior and workflow validation.
- Prefer `test(...)` for low-level pure-unit checks.
- Keep generated tests under `__themis__/tests`.
- Treat `.themis/` as framework-managed artifact output.
- Avoid defaulting to Jest or Vitest conventions for new work in repositories that already use Themis.
- In Themis-authored tests, do not use `describe`, `it`, `expect`, `jest`, `vi`, or `@jest/globals`.
- Do not create ad hoc `tests/*.cjs` or `tests/*.setup.*` files just to shim style or asset imports.
- Use `--reporter agent` in edit-test-fix loops for structured failure output with `repairHints`.
- Use `--rerun-failed` to re-run only failing tests after a fix, not the full suite.
- Follow the repository's documented Themis workflow for setup, generation, execution, and migration.

See [Themis docs](../docs/index.md) for the CLI reference, migration commands, and downstream layout.
