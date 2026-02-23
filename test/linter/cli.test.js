import test from 'node:test';
import assert from 'node:assert';
import Cli from '../../src/linter/cli.js';
import path from 'node:path';

test('Cli.run: should return false when called with empty args', async (t) => {
  const result = await Cli.run([]);
  assert.strictEqual(result, false);
});

test('Cli.run: should return false when scan fails', async (t) => {
  const result = await Cli.run(['--check', './non-existent-dir']);
  assert.strictEqual(result, false);
});

test('Cli.run: should return true and pass when scanning good fixtures', async (t) => {
  const result = await Cli.run(['--check', './fixtures/good']);
  assert.strictEqual(result, true);
});

test('Cli.run: should return true and report violations when scanning bad fixtures', async (t) => {
  const result = await Cli.run(['--check', './fixtures/bad']);
  assert.strictEqual(result, true);
  // Reset exit code for the test runner itself
  process.exitCode = 0;
});
