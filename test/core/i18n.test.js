import test from 'node:test';
import assert from 'node:assert';
import { parseHTML } from 'linkedom';
import The from '../../src/core/The.js';

test('The._t: should exist as a static function', (t) => {
  assert.strictEqual(typeof The._t, 'function');
});

test('The._t: should return value from dictionary', (t) => {
  The.dictionary = { hello: 'world' };
  assert.strictEqual(The._t('hello'), 'world');
});
