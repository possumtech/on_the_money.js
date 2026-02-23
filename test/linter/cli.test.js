import test from 'node:test';
import assert from 'node:assert';
import Cli from '../../src/linter/cli.js';

test('Cli.run: should exist as a static function', (t) => {
  assert.strictEqual(typeof Cli.run, 'function');
});
