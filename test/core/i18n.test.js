import test from 'node:test';
import assert from 'node:assert';
import The from '../../src/core/The.js';

test('The._t: should exist as a static function', (t) => {
  assert.strictEqual(typeof The._t, 'function');
});

test('The._t: should throw "Not implemented"', (t) => {
  assert.throws(() => {
    The._t('key');
  }, { message: 'The._t: Not implemented' });
});
