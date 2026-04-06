# Migrate an Existing Jest Test Suite to Themis

## Problem Description

The `payments-sdk` team has been running their unit tests with Jest for two years. After evaluating alternatives, the team has decided to adopt Themis as their testing framework going forward. They want to migrate their existing Jest test suite rather than maintaining two frameworks in parallel.

A tech lead has been asked to produce a migration plan and execution script. The team is concerned about the scope of the migration — they have around 40 test files — and wants to make sure the right approach is taken from the start rather than spending days manually rewriting tests one by one.

Your task is to produce a concrete migration plan and a shell script that carries out the migration for this project.

## Output Specification

1. A `migration-plan.md` document describing the high-level approach, the commands that will be run, and what the project will look like afterwards.
2. A `migrate.sh` shell script containing the actual commands to perform the migration. The script should be annotated with comments explaining each step.
3. A `MIGRATION_NOTES.md` file documenting any caveats, what to do if some tests fail after migration, and how to handle tests that cannot be automatically migrated.

Do not actually execute the migration — just produce the planning and scripting artifacts.

## Input Files

The following files are provided as inputs. Extract them before beginning.

=============== FILE: package.json ===============
{
  "name": "payments-sdk",
  "version": "3.2.1",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}

=============== FILE: jest.config.ts ===============
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
};

export default config;

=============== FILE: src/__tests__/payment.test.ts ===============
import { describe, it, expect, beforeEach } from '@jest/globals';
import { processPayment } from '../payment';

describe('processPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return success for valid card', () => {
    const result = processPayment({ amount: 100, currency: 'USD', card: '4111111111111111' });
    expect(result.status).toBe('success');
  });

  it('should throw for negative amount', () => {
    expect(() => processPayment({ amount: -1, currency: 'USD', card: '4111111111111111' })).toThrow();
  });
});
