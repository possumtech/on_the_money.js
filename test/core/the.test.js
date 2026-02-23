import test from 'node:test';
import assert from 'node:assert';
import The from '../../src/core/The.js';

test('The.the: should exist as a static function', (t) => {
  assert.strictEqual(typeof The.the, 'function');
});

test('The.the: should throw "Not implemented"', (t) => {
  assert.throws(() => {
    The.the('key', 'value');
  }, { message: 'The.the: Not implemented' });
});
