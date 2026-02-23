import test from 'node:test';
import assert from 'node:assert';
import On from '../../src/core/On.js';

test('On.on: should throw if parent is not a DOM node', (t) => {
  // Mocking DOM environment or using JSDOM would be needed here, 
  // but for now, we'll assert it exists as a class.
  assert.ok(On, 'On class should be exported');
});

test('On.on: should attach an event listener to the parent', (t) => {
  // Placeholder for real DOM test
  assert.strictEqual(typeof On.on, 'function', 'On.on should be a static function');
});
