const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { printAgent } = require('../src/reporter');
const { writeRunArtifacts } = require('../src/artifacts');

const AGENT_SCHEMA_PATH = path.join(__dirname, '..', 'docs', 'schemas', 'agent-result.v1.json');
const FAILURES_SCHEMA_PATH = path.join(__dirname, '..', 'docs', 'schemas', 'failures.v1.json');
const GENERATE_SCHEMA_PATH = path.join(__dirname, '..', 'docs', 'schemas', 'generate-result.v1.json');
const GENERATE_MAP_SCHEMA_PATH = path.join(__dirname, '..', 'docs', 'schemas', 'generate-map.v1.json');
const GENERATE_HANDOFF_SCHEMA_PATH = path.join(__dirname, '..', 'docs', 'schemas', 'generate-handoff.v1.json');
const GENERATE_BACKLOG_SCHEMA_PATH = path.join(__dirname, '..', 'docs', 'schemas', 'generate-backlog.v1.json');
const CLI_PATH = path.join(__dirname, '..', 'bin', 'themis.js');

describe('schema contracts', () => {
  function loadSchema(schemaPath) {
    return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  }

  function captureConsoleLog(run) {
    const original = console.log;
    const lines = [];
    console.log = (...args) => {
      lines.push(args.join(' '));
    };
    try {
      run();
    } finally {
      console.log = original;
    }
    return lines.join('\n');
  }

  function resolveRef(rootSchema, ref) {
    if (!ref.startsWith('#/')) {
      throw new Error(`Unsupported schema ref: ${ref}`);
    }
    const tokens = ref.slice(2).split('/');
    let current = rootSchema;
    for (const token of tokens) {
      current = current[token];
      if (current === undefined) {
        throw new Error(`Invalid schema ref token "${token}" for ref ${ref}`);
      }
    }
    return current;
  }

  function assertMatchesSchema(value, schema, rootSchema, atPath = '$') {
    const workingSchema = schema.$ref ? resolveRef(rootSchema, schema.$ref) : schema;

    if (Array.isArray(workingSchema.type)) {
      let lastError = null;
      for (const candidateType of workingSchema.type) {
        try {
          assertMatchesSchema(value, { ...workingSchema, type: candidateType }, rootSchema, atPath);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error(`Unsupported schema union at ${atPath}`);
    }

    if (workingSchema.const !== undefined) {
      expect(value).toBe(workingSchema.const);
      return;
    }

    if (Array.isArray(workingSchema.enum)) {
      expect(workingSchema.enum.includes(value)).toBe(true);
      return;
    }

    if (workingSchema.type === 'object') {
      expect(typeof value).toBe('object');
      expect(value === null).toBe(false);
      expect(Array.isArray(value)).toBe(false);

      const required = workingSchema.required || [];
      for (const key of required) {
        expect(Object.prototype.hasOwnProperty.call(value, key)).toBe(true);
      }

      const properties = workingSchema.properties || {};
      if (workingSchema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          expect(Object.prototype.hasOwnProperty.call(properties, key)).toBe(true);
        }
      }

      for (const [key, propertySchema] of Object.entries(properties)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue;
        }
        assertMatchesSchema(value[key], propertySchema, rootSchema, `${atPath}.${key}`);
      }
      return;
    }

    if (workingSchema.type === 'array') {
      expect(Array.isArray(value)).toBe(true);
      const itemSchema = workingSchema.items || {};
      for (let i = 0; i < value.length; i += 1) {
        assertMatchesSchema(value[i], itemSchema, rootSchema, `${atPath}[${i}]`);
      }
      return;
    }

    if (workingSchema.type === 'string') {
      expect(typeof value).toBe('string');
      return;
    }

    if (workingSchema.type === 'number') {
      expect(typeof value).toBe('number');
      return;
    }

    if (workingSchema.type === 'boolean') {
      expect(typeof value).toBe('boolean');
      return;
    }

    if (workingSchema.type === 'null') {
      expect(value).toBe(null);
      return;
    }

    throw new Error(`Unsupported schema type at ${atPath}: ${String(workingSchema.type)}`);
  }

  test('agent reporter output matches docs schema contract', () => {
    const schema = loadSchema(AGENT_SCHEMA_PATH);
    const result = {
      meta: {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        maxWorkers: 2
      },
      summary: {
        total: 2,
        passed: 1,
        failed: 1,
        skipped: 0,
        durationMs: 3.2
      },
      files: [
        {
          file: '/tmp/sample.test.js',
          tests: [
            {
              name: 'works',
              fullName: 'suite > works',
              status: 'passed',
              durationMs: 1.1,
              error: null
            },
            {
              name: 'fails',
              fullName: 'suite > fails',
              status: 'failed',
              durationMs: 2.1,
              error: {
                message: 'boom',
                stack: 'stack'
              }
            }
          ]
        }
      ]
    };

    const output = captureConsoleLog(() => {
      printAgent(result);
    });
    const payload = JSON.parse(output);
    assertMatchesSchema(payload, schema, schema);
    expect(payload.analysis.fingerprintVersion).toBe('fnv1a32-message-v1');
    expect(payload.analysis.failureClusters.length).toBe(1);
    expect(payload.analysis.failureClusters[0].count).toBe(1);
    expect(payload.analysis.failureClusters[0].fingerprint).toBe(payload.failures[0].fingerprint);
    expect(payload.analysis.stability.runs).toBe(1);
    expect(payload.analysis.stability.summary.stablePass).toBe(1);
    expect(payload.analysis.stability.summary.stableFail).toBe(1);
    expect(payload.analysis.stability.summary.unstable).toBe(0);
    expect(payload.analysis.comparison.status).toBe('baseline');
    expect(payload.artifacts.runDiff).toBe('.themis/run-diff.json');
  });

  test('failed-tests artifact output matches docs schema contract', () => {
    const schema = loadSchema(FAILURES_SCHEMA_PATH);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-schema-'));
    const result = {
      meta: {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        maxWorkers: 1
      },
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs: 1.9
      },
      files: [
        {
          file: '/tmp/sample.test.js',
          tests: [
            {
              name: 'fails',
              fullName: 'suite > fails',
              status: 'failed',
              durationMs: 1.9,
              error: {
                message: 'boom',
                stack: 'stack'
              }
            }
          ]
        }
      ]
    };

    try {
      const { failuresPath } = writeRunArtifacts(tempDir, result);
      const payload = JSON.parse(fs.readFileSync(failuresPath, 'utf8'));
      assertMatchesSchema(payload, schema, schema);
      expect(typeof payload.runId).toBe('string');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('generate --json output matches docs schema contract', () => {
    const schema = loadSchema(GENERATE_SCHEMA_PATH);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-generate-schema-'));

    try {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'src', 'math.js'),
        `module.exports = {\n  add(a, b) {\n    return a + b;\n  }\n};\n`,
        'utf8'
      );

      const proc = spawnSync(process.execPath, [CLI_PATH, 'generate', 'src', '--json'], {
        cwd: tempDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          NO_COLOR: '1'
        }
      });

      expect(proc.status).toBe(0);
      const payload = JSON.parse(proc.stdout);
      assertMatchesSchema(payload, schema, schema);
      expect(payload.summary.generated).toBe(1);
      expect(payload.generatedFiles[0]).toBe('tests/generated/math.generated.test.js');
      expect(payload.artifacts.generateBacklog).toBe('.themis/generate-backlog.json');
      expect(payload.mode.writeHints).toBe(false);
      expect(payload.hintFiles.created.length).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('generate map artifact matches docs schema contract', () => {
    const schema = loadSchema(GENERATE_MAP_SCHEMA_PATH);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-generate-map-schema-'));

    try {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'src', 'math.js'),
        `module.exports = {\n  add(a, b) {\n    return a + b;\n  }\n};\n`,
        'utf8'
      );

      const proc = spawnSync(process.execPath, [CLI_PATH, 'generate', 'src', '--json'], {
        cwd: tempDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          NO_COLOR: '1'
        }
      });

      expect(proc.status).toBe(0);
      const mapPayload = JSON.parse(fs.readFileSync(path.join(tempDir, '.themis', 'generate-map.json'), 'utf8'));
      assertMatchesSchema(mapPayload, schema, schema);
      expect(mapPayload.entries[0].sourceFile).toBe('src/math.js');
      expect(mapPayload.entries[0].testFile).toBe('tests/generated/math.generated.test.js');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('generate handoff artifact matches docs schema contract', () => {
    const schema = loadSchema(GENERATE_HANDOFF_SCHEMA_PATH);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-generate-handoff-schema-'));

    try {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'src', 'math.js'),
        `module.exports = {\n  add(a, b) {\n    return a + b;\n  }\n};\n`,
        'utf8'
      );

      const proc = spawnSync(process.execPath, [CLI_PATH, 'generate', 'src', '--plan'], {
        cwd: tempDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          NO_COLOR: '1'
        }
      });

      expect(proc.status).toBe(0);
      const handoffPayload = JSON.parse(fs.readFileSync(path.join(tempDir, '.themis', 'generate-handoff.json'), 'utf8'));
      assertMatchesSchema(handoffPayload, schema, schema);
      expect(handoffPayload.schema).toBe('themis.generate.handoff.v1');
      expect(handoffPayload.targets[0].sourceFile).toBe('src/math.js');
      expect(handoffPayload.artifacts.generateBacklog).toBe('.themis/generate-backlog.json');
      expect(handoffPayload.hintFiles.created.length).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('generate backlog artifact matches docs schema contract', () => {
    const schema = loadSchema(GENERATE_BACKLOG_SCHEMA_PATH);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-generate-backlog-schema-'));

    try {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'src', 'math.js'),
        `module.exports = {\n  add(a, b) {\n    return a + b;\n  }\n};\n`,
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'src', 'format.js'),
        `module.exports = {\n  formatStatus(status) {\n    return String(status).toUpperCase();\n  }\n};\n`,
        'utf8'
      );
      fs.mkdirSync(path.join(tempDir, 'tests', 'generated'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'tests', 'generated', 'math.generated.test.js'),
        `test('user test', () => {\n  expect(true).toBe(true);\n});\n`,
        'utf8'
      );

      const proc = spawnSync(process.execPath, [CLI_PATH, 'generate', 'src', '--review', '--strict', '--json'], {
        cwd: tempDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          NO_COLOR: '1'
        }
      });

      expect(proc.status).toBe(1);
      const backlogPayload = JSON.parse(fs.readFileSync(path.join(tempDir, '.themis', 'generate-backlog.json'), 'utf8'));
      assertMatchesSchema(backlogPayload, schema, schema);
      expect(backlogPayload.schema).toBe('themis.generate.backlog.v1');
      expect(backlogPayload.summary.total).toBe(2);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
