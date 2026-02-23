import test from 'node:test';
import assert from 'node:assert';
import Cli from '../../src/linter/cli.js';

test('Cli.run: should not throw when called with empty args', (t) => {
  assert.strictEqual(Cli.run(), false);
});

test('Cli.run: should handle --check flag', (t) => {
  assert.strictEqual(Cli.run(['--check', './src']), true);
});
