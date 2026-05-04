---
description: Migrate this repo from Jest, Vitest, or node:test to Themis
---

Migrate this repository from Jest, Vitest, or `node:test` to Themis. If the user did not say which, detect it:
- `node:test`: grep `bridge-tests/`, `tests/`, or `test/` for `import .* from 'node:test'`. If matches, source is `node`.
- Otherwise check `package.json` devDependencies for `jest` or `vitest`.

For Jest or Vitest, run the four steps in order, and run `npx themis test` between each:

```bash
npx themis migrate <jest|vitest>                    # 1. scaffold compatibility
npx themis migrate <jest|vitest> --rewrite-imports  # 2. rewrite imports
npx themis migrate <jest|vitest> --convert          # 3. codemod to native style
npx themis migrate <jest|vitest> --assist           # 4. emit structured findings
```

For `node:test`, the codemod converts directly with no compat shim. Run `--convert` then `--assist` (no `--rewrite-imports`):

```bash
npx themis migrate node --convert                   # 1. drop node:test/node:assert imports + rewrite asserts
npx themis migrate node --assist                    # 2. emit structured findings
```

If the migrated `node:test` suite mutates `process.env` or `process.cwd()` at module load (a common pattern for redirecting `os.homedir()` to a temp dir before importing the SUT), run tests with per-file process isolation: `npx themis test --isolation process`. This spawns a fresh Node child process per file (mirrors `node --test`); the default `worker` mode freezes `os.homedir()` and shares the ESM module cache across files.

After the assist step, read the findings report (its path is printed at the end of the command) and walk through any items it flags for manual follow-up. Do not guess at fixes — the report tells you what needs human attention and why.

If the user passed extra arguments, forward them: $ARGUMENTS
