# Testing With Claude Code and Themis

A step-by-step walkthrough showing how Themis turns Claude Code into a test-writing machine that gets it right on the first try.

## The Problem

When you ask Claude Code to write unit tests, it reaches for Jest or Vitest by default. The tests it generates are often correct, but just as often they have subtle issues: wrong import paths, misused mocking APIs, snapshot tests where assertions would be better, setup files where the framework handles things natively. You end up in an edit-test-fix loop that burns time and context window.

Themis fixes this by shipping structured guidance directly to Claude Code — a skill, slash commands, and a `CLAUDE.md` that tells Claude exactly how to write, run, and fix tests. No copy-pasting docs. No explaining the framework. Claude just knows.

## What You'll See

By the end of this tutorial you'll have:

1. A Node.js project with Themis installed and Claude Code fully wired up
2. Generated tests that pass on the first run
3. A structured failure-fix loop where Claude reads machine-parseable repair hints instead of raw stack traces
4. Slash commands (`/themis-test`, `/themis-generate`, `/themis-fix`) that work out of the box

## Step 1: Set Up a Project

Start with any Node.js or TypeScript project. For this tutorial we'll use a small utility library.

```bash
mkdir demo-project && cd demo-project
npm init -y
```

Create a source file at `src/cart.js`:

```js
class Cart {
  constructor() {
    this.items = [];
  }

  add(item) {
    if (!item || !item.name || typeof item.price !== 'number') {
      throw new TypeError('Item must have a name and a numeric price');
    }
    const existing = this.items.find((i) => i.name === item.name);
    if (existing) {
      existing.quantity += item.quantity || 1;
    } else {
      this.items.push({ ...item, quantity: item.quantity || 1 });
    }
  }

  remove(name) {
    const index = this.items.findIndex((i) => i.name === name);
    if (index === -1) throw new Error(`Item "${name}" not in cart`);
    this.items.splice(index, 1);
  }

  total() {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  checkout(paymentMethod) {
    if (this.items.length === 0) throw new Error('Cannot checkout an empty cart');
    const receipt = {
      items: this.items.map((i) => ({ ...i })),
      total: this.total(),
      paymentMethod,
      timestamp: new Date().toISOString()
    };
    this.items = [];
    return receipt;
  }
}

module.exports = { Cart };
```

## Step 2: Install Themis With Claude Code Integration

```bash
npm install -D @vitronai/themis@latest
npx themis init --claude-code
```

That one command installs:

- `CLAUDE.md` — adoption rules at the repo root that Claude Code reads automatically
- `.claude/skills/themis/SKILL.md` — a skill that auto-loads when Claude sees a test-related request
- `.claude/commands/themis-test.md` — `/themis-test` slash command
- `.claude/commands/themis-generate.md` — `/themis-generate` slash command
- `.claude/commands/themis-migrate.md` — `/themis-migrate` slash command
- `.claude/commands/themis-fix.md` — `/themis-fix` slash command

You can verify:

```bash
cat CLAUDE.md          # Themis adoption rules
ls .claude/skills/     # themis/SKILL.md
ls .claude/commands/   # four slash command files
```

## Step 3: Generate Tests

Open Claude Code in the project and type:

```
/themis-generate src
```

Claude uses the installed skill context to run `npx themis generate src`. Generated tests land under `__themis__/tests/` as `.generated.test.js` files. These are deterministic, contract-style tests — not LLM-generated guesses.

## Step 4: Run the Test Loop

```
/themis-test
```

This runs `npx themis test --reporter agent` and Claude reads the structured JSON output. If everything passes, you're done. If there are failures, Claude sees:

```json
{
  "failures": [
    {
      "cluster": "cart-checkout-validation",
      "repairHints": ["checkout() throws when cart is empty — test passes an empty cart but expects success"],
      "sourceFile": "src/cart.js",
      "lineNumber": 32,
      "expected": "Error: Cannot checkout an empty cart",
      "actual": "{ items: [], total: 0 }"
    }
  ]
}
```

Instead of re-reading a raw stack trace, Claude acts on the `repairHints` directly. This is the key difference: structured signals instead of unstructured error output.

## Step 5: Ask Claude to Write More Tests

Now ask Claude to add coverage for edge cases:

```
Write additional tests for the Cart class covering:
- adding duplicate items increments quantity
- removing a non-existent item throws
- checkout clears the cart
- total with no items returns 0
```

Because the Themis skill is loaded, Claude will:

1. Use `intent(...)` for behavior tests and `test(...)` for pure unit checks
2. Follow the four-phase shape: context, run, verify, cleanup
3. Use `expect(...)` assertions (not snapshots)
4. Place tests alongside the generated ones, not in a random `tests/` directory

Run `/themis-test` again to verify.

## Step 6: Fix Failures (When They Happen)

If any test fails, use:

```
/themis-fix
```

Claude will:

1. Run `npx themis test --reporter agent` to get the current failures
2. Group failures by `cluster` — fixes within a cluster share a root cause
3. Read `repairHints` before looking at the stack trace
4. Apply the smallest fix that addresses the root cause
5. Re-run with `--rerun-failed` to confirm the fix without running the full suite

This cluster-based fixing is faster than fixing tests one at a time, and the `--rerun-failed` flag means you don't pay the cost of a full suite run after each fix.

## Step 7: Optional — Wire Up the Automated Hook

For the tightest possible loop, add a PostToolUse hook that runs Themis automatically after every edit Claude makes:

Add this to `.claude/settings.json`:

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

Now every time Claude edits a `.js`/`.ts`/`.jsx`/`.tsx` file, Themis runs automatically. If tests fail, the structured failure JSON is fed back into the conversation — Claude sees it immediately and can fix it in the next turn without you running anything.

The hook is smart about scope:

- Skips non-source edits (docs, config, etc.)
- Uses `--rerun-failed` when there's a prior failure artifact
- Exits silently when tests pass (no context noise)
- Set `THEMIS_HOOK_DISABLED=1` to pause it temporarily

## Why This Works

The magic is not in Themis being a better test runner (though it is faster). The magic is in the **structured agent context**:

1. **The skill** tells Claude exactly when and how to use Themis — it auto-loads without you mentioning the framework
2. **The CLAUDE.md** provides rules about what to avoid (no setup shims, no snapshots as defaults, no ad-hoc test directories)
3. **The `--reporter agent` output** gives Claude machine-parseable failure data with repair hints, instead of raw stack traces it has to re-parse
4. **The slash commands** encode the correct workflow so Claude doesn't have to figure out which flags to pass

In Tessl evaluations across 10 scenarios, agents scored **37% without** the Themis skill context and **97% with it**. The context is the product.

## What's Next

- **Migrate from Jest or Vitest**: Run `/themis-migrate` — Claude walks through the four-step incremental migration
- **Cursor users**: Run `npx themis init --cursor` to install `.cursorrules`
- **Both at once**: `npx themis init --agents --claude-code --cursor`
- **Auto-detection**: A bare `npx themis init` detects which agents are present and installs the right assets automatically

## Links

- npm: [`@vitronai/themis`](https://www.npmjs.com/package/@vitronai/themis)
- GitHub: [vitron-ai/themis](https://github.com/vitron-ai/themis)
- Tessl tile: [vitron-ai/themis](https://tessl.io/registry/vitron-ai/themis)
- Eval results: [37% baseline → 97% with skill](https://tessl.io/eval-runs/019d72a0-8211-74ea-84ef-a8e336ead3d2)
- Adoption guide: [`docs/agents-adoption.md`](agents-adoption.md)
