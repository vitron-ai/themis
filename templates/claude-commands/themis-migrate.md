---
description: Migrate this repo from Jest or Vitest to Themis
---

Migrate this repository from Jest or Vitest to Themis. If the user did not say which, detect it: check `package.json` devDependencies for `jest` or `vitest`.

Run the four steps in order, and run `npx themis test` between each step to confirm the suite is still green:

```bash
npx themis migrate <jest|vitest>                    # 1. scaffold compatibility
npx themis migrate <jest|vitest> --rewrite-imports  # 2. rewrite imports
npx themis migrate <jest|vitest> --convert          # 3. codemod to native style
npx themis migrate <jest|vitest> --assist           # 4. emit structured findings
```

After step 4, read the findings report (its path is printed at the end of the command) and walk through any items it flags for manual follow-up. Do not guess at fixes — the report tells you what needs human attention and why.

If the user passed extra arguments, forward them: $ARGUMENTS
