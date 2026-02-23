import test from 'node:test';
import assert from 'node:assert';
import { parseHTML } from 'linkedom';
import Select from '../../src/core/Select.js';

const setupDOM = (html = '') => {
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  globalThis.document = document;
  return document;
};

test('Select.$: should find element in document by default', (t) => {
  setupDOM('<div class="find-me"></div>');
  const el = Select.$('.find-me');
  assert.ok(el);
  assert.strictEqual(el.className, 'find-me');
});

test('Select.$: should find element within context', (t) => {
  const dom = setupDOM(`
    <div class="parent">
      <span class="child"></span>
    </div>
    <span class="child" id="outside"></span>
  `);
  const parent = dom.querySelector('.parent');
  const child = Select.$(parent, '.child');
  assert.ok(child);
  assert.strictEqual(child.id, '');
});

test('Select.$$: should return real Array', (t) => {
  setupDOM('<ul><li>1</li><li>2</li></ul>');
  const items = Select.$$('li');
  assert.ok(Array.isArray(items));
  assert.strictEqual(items.length, 2);
});

test('Select.clone: should clone template and return first element', (t) => {
  const dom = setupDOM(`
    <template id="tmp">
      <div class="cloned">Hello</div>
    </template>
  `);
  const el = Select.clone('#tmp');
  assert.ok(el);
  assert.strictEqual(el.className, 'cloned');
  assert.strictEqual(el.textContent, 'Hello');
});

test('Select.clone: should throw if template not found', (t) => {
  setupDOM('');
  assert.throws(() => {
    Select.clone('#missing');
  });
});
