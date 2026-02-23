import test from 'node:test';
import assert from 'node:assert';
import Translate from '../../src/core/Translate.js';

test('Translate._t: should exist as a static function', (t) => {
  assert.strictEqual(typeof Translate._t, 'function');
});

test('Translate._t: should throw "Not implemented"', (t) => {
  assert.throws(() => {
    Translate._t('key');
  }, { message: 'Translate._t: Not implemented' });
});
