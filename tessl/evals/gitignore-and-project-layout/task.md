# Set Up Themis in a New TypeScript Project

## Problem Description

A small team is starting a new TypeScript library called `data-forge` for data transformation utilities. They have decided to adopt Themis as their unit testing framework from the start. A junior developer has initialized the repository but has not yet configured the testing infrastructure.

The team lead wants to make sure the project is set up correctly so that:
- The right directories and artifacts are excluded from version control
- The framework is initialized properly for agent-assisted workflows
- Any new tests the team writes land in the right location

The repository currently has a minimal structure: a `src/` folder, a `package.json`, and an empty `.gitignore`. No test files exist yet.

## Output Specification

Produce the following files representing the correct initial configuration for this project:

1. A `.gitignore` file that includes the appropriate Themis-specific entries (add to any content already there).
2. A shell script `setup.sh` that contains the Themis CLI commands needed to initialize the project for agent-assisted test workflows and generate initial tests for the `src/` directory.
3. A `SETUP_NOTES.md` file documenting what each directory created by Themis is used for and whether it should be committed to version control.

## Input Files

The following files are provided as inputs. Extract them before beginning.

=============== FILE: .gitignore ===============
node_modules/
dist/
*.log

=============== FILE: package.json ===============
{
  "name": "data-forge",
  "version": "0.1.0",
  "description": "Data transformation utilities",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
