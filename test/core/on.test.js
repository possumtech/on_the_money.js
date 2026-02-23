import test from 'node:test';
import assert from 'node:assert';
import On from '../../src/core/On.js';

test('On.on: should throw "Not implemented"', (t) => {
  assert.throws(() => {
    On.on(null, 'click', 'selector', () => {});
  }, { message: 'On.on: Not implemented' });
});

test('On.emit: should throw "Not implemented"', (t) => {
  assert.throws(() => {
    On.emit(null, 'custom-event', {});
  }, { message: 'On.emit: Not implemented' });
});
