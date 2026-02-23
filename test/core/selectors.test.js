import test from 'node:test';
import assert from 'node:assert';
import Select from '../../src/core/Select.js';

test('Select.$: should exist as a static function', (t) => {
  assert.strictEqual(typeof Select.$, 'function');
});

test('Select.$$: should exist as a static function', (t) => {
  assert.strictEqual(typeof Select.$$, 'function');
});
