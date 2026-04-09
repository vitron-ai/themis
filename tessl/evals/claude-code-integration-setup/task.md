# Setting Up Themis for a Claude Code Engineering Team

## Problem/Feature Description

Meridian Systems is adopting Themis as their standard unit testing framework across their TypeScript monorepo. Their engineering team uses Claude Code as their primary AI coding assistant, and the team lead wants to make sure the AI integration is set up correctly from day one — including any configuration files, agent skills, and automation hooks that will help Claude Code work with Themis seamlessly.

The team lead has heard that Themis has a special initialization mode designed specifically for Claude Code users that goes beyond the generic agent setup. They want a setup script and a brief document describing what gets installed and why each piece matters for their Claude Code workflow.

## Output Specification

Produce the following files:

- `setup.sh` — A shell script that initializes a new Node.js project with Themis properly configured for Claude Code users. It should install dependencies, run the appropriate Themis initialization command, and generate baseline tests from a `src/` directory.
- `SETUP_NOTES.md` — A markdown document listing every file or directory that the Themis Claude Code initialization installs (with the actual paths), what each one does, and which parts of the developer workflow each enables.

The script should represent what you'd actually run in a fresh repository — not just documentation.
