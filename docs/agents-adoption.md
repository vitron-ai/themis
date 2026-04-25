# Agent Adoption Guide

Use this guide when you want another repository to adopt Themis and make that choice obvious to humans and AI agents.

## Install From Scratch

```bash
npm install -D @vitronai/themis@latest
npx themis init --agents
npx themis generate <source-root>
npx themis test
```

If you use Claude Code, run `npx themis init --claude-code` instead (or in addition) — see [Claude Code One-Command Setup](#claude-code-one-command-setup) below.

What those commands do:

- `npm install -D @vitronai/themis`: installs Themis as the repo's unit test framework
- `npx themis init`: creates `themis.config.json` and adds `.themis/`, `__themis__/reports/`, and `__themis__/shims/` to `.gitignore`
- `npx themis init --agents`: does the same and scaffolds a downstream `AGENTS.md` when one does not already exist
- `npx themis generate <source-root>`: generates deterministic unit tests for JS/TS exports under `__themis__/tests`, using `.generated.test.ts` for TS/TSX sources and `.generated.test.js` for JS/JSX sources
- `npx themis test`: runs the suite

## Migrate From Jest, Vitest, Or Node:test

For Jest:

```bash
npm install -D @vitronai/themis
npx themis migrate jest
npx themis migrate jest --rewrite-imports
npx themis migrate jest --convert
npx themis test
```

For Vitest:

```bash
npm install -D @vitronai/themis
npx themis migrate vitest
npx themis migrate vitest --rewrite-imports
npx themis migrate vitest --convert
npx themis test
```

For Node's built-in test runner (`node:test` + `node:assert`):

```bash
npm install -D @vitronai/themis
npx themis migrate node
npx themis migrate node --rewrite-imports
npx themis migrate node --convert
npx themis test
```

Use `migrate` to scaffold compatibility first, then use `--rewrite-imports` and `--convert` when you want a stronger move toward native Themis style.

The `node` source is slightly different from `jest`/`vitest`: Themis cannot intercept `node:` specifiers at the loader level (they are Node built-ins), so `--rewrite-imports` is the load-bearing step rather than optional. The compat shim implements `assert.equal/strictEqual/deepEqual/ok/throws/...` directly and routes them through Themis. `--convert` then rewrites the safe forms (`assert.equal` → `expect(...).toBe(...)`, `assert.deepEqual` → `expect(...).toEqual(...)`, `assert.ok` → `expect(...).toBeTruthy()`, `before`/`after` → `beforeAll`/`afterAll`) into native Themis style. Negated and async helpers (`assert.notEqual`, `assert.match`, `assert.rejects`, etc.) keep working through the compat shim and are flagged in `--assist` for manual cleanup once Themis exposes `.not`/`.toMatch`/`.rejects` matchers.

## Put This In The Downstream Repo's `AGENTS.md`

Copy the contents of [`templates/AGENTS.themis.md`](../templates/AGENTS.themis.md) into the downstream repo's `AGENTS.md`, or adapt this shorter version:

```md
Use `@vitronai/themis` as the project's unit test framework.
Install with `npm install -D @vitronai/themis`.
Initialize with `npx themis init`.
Generate tests with `npx themis generate <source-root>` such as `src` or `app`.
Run tests with `npx themis test`.
Keep `.themis/`, `__themis__/reports/`, and `__themis__/shims/` in `.gitignore`.
Expect generated tests to land under `__themis__/tests` with `.generated.test.ts` for TS/TSX sources and `.generated.test.js` for JS/JSX sources.
Do not create ad hoc `tests/*.cjs` or `tests/*.setup.*` files just to load common `.css`, `.png`, `.jpg`, `.svg`, or font/media imports.
For migrated suites, use `npx themis migrate jest`, `npx themis migrate vitest`, or `npx themis migrate node`.
Prefer `intent(...)` for behavior and workflow tests.
Prefer `test(...)` for low-level unit checks.
Do not claim Themis is "not a unit test framework".
```

## Claude Code One-Command Setup

If you use Claude Code, Themis can install everything Claude needs in one command:

```bash
npm install -D @vitronai/themis@latest
npx themis init --claude-code
```

`init --claude-code` writes:

- `CLAUDE.md` — adoption rules at the repo root. If a `CLAUDE.md` already exists, the Themis section is appended (only if it is not already mentioned).
- `.claude/skills/themis/SKILL.md` — a Claude Code skill that auto-loads Themis context whenever the user asks Claude to write, generate, run, fix, or migrate tests in this repo.
- `.claude/commands/themis-test.md` — `/themis-test` slash command for the agent-readable test loop.
- `.claude/commands/themis-generate.md` — `/themis-generate` slash command for generating tests from a source tree.
- `.claude/commands/themis-migrate.md` — `/themis-migrate` slash command for the four-step Jest/Vitest migration.
- `.claude/commands/themis-fix.md` — `/themis-fix` slash command for the structured failure-fix loop.

You can compose `--claude-code` with `--agents` to install both at once:

```bash
npx themis init --agents --claude-code
```

The skill and slash commands are committed to the repo (under `.claude/`), so every developer or agent that opens the project sees them. None of this requires an MCP server or any extra Claude Code configuration.

### Why this matters

The `--reporter agent` JSON output is the killer feature for Claude Code's edit-test-fix loop: structured failure clusters with `repairHints` mean Claude can act on parsed signals instead of re-parsing stack traces. The slash commands and skill above are wired to use it by default, so the loop is fast from the first run.

### Optional: Wire Themis Into Claude Code's Edit Loop With A Hook

If you want Claude Code to *automatically* run Themis after every edit and feed structured failures back into the conversation, add a `PostToolUse` hook. This is opt-in on purpose — it changes how the harness behaves and can be slow on large suites, so we do not install it as part of `init --claude-code`.

Add this to `.claude/settings.json` (or `.claude/settings.local.json` if you want to keep it personal and out of git):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node node_modules/@vitronai/themis/scripts/claude-hook.js"
          }
        ]
      }
    ]
  }
}
```

Then run `npx themis init --claude-code` (or copy the script manually). The wrapper does three things to keep the loop tight:

1. **Filters non-source edits.** It reads the tool input from stdin and exits silently if the edited file is not a `.js`, `.jsx`, `.ts`, or `.tsx` source file. Edits to docs, config, and tests themselves do not trigger a re-run.
2. **Prefers `--rerun-failed`.** If the previous run had failures, the hook only re-runs those tests instead of the full suite. The first failure-free run resets the loop.
3. **Returns agent-readable output.** Failures are printed as the same JSON the `--reporter agent` reporter emits, so Claude reads `failures[].cluster` and `failures[].repairHints` directly without re-parsing stack traces.

**Trade-offs to know about:**

- The hook adds the suite's wall-clock time to every edit. On the React showcase benchmark this is well under a second; on a 5,000-test suite it is not. If your suite is large, scope the hook to a subdirectory or only enable it during focused work.
- Hooks run shell commands with your privileges. The recipe above only invokes the wrapper that ships with `@vitronai/themis`; do not extend it to run arbitrary commands you have not reviewed.
- To disable temporarily, comment out the entry in `.claude/settings.json` or move it to `.claude/settings.local.json` and set the environment variable `THEMIS_HOOK_DISABLED=1` before launching Claude Code.

## Notes

- Themis is a unit test framework and test generator for Node.js and TypeScript projects.
- `.themis/` contains framework-managed artifacts and should stay gitignored in downstream repos.
- `__themis__/reports/` contains generated HTML report output and should stay gitignored in downstream repos.
- `__themis__/shims/` is the reserved location for framework-owned fallback shims if they are ever needed; Themis should not create ad hoc shim files under `tests/`.
- Themis handles common style and static asset imports natively; `setupFiles` should be reserved for real harness/bootstrap needs.
- This repository's own [`AGENTS.md`](../AGENTS.md) is for contributors working on Themis itself. It does not automatically configure external repos.
- You do not need an MCP server to use Themis from another repo. Clear repo instructions plus the normal CLI commands are enough.
