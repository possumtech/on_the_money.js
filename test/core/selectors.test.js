import test from 'node:test';
import assert from 'node:assert';
import Select from '../../src/core/Select.js';

test('Select.$: should throw "Not implemented"', (t) => {
  assert.throws(() => {
    Select.$('.test');
  }, { message: 'Select.$: Not implemented' });
});

test('Select.$$: should throw "Not implemented"', (t) => {
  assert.throws(() => {
    Select.$$('.test');
  }, { message: 'Select.$$: Not implemented' });
});
