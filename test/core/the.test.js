import test from 'node:test';
import assert from 'node:assert';
import { parseHTML } from 'linkedom';
import The from '../../src/core/The.js';

const setupDOM = (html = '') => {
  const dom = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  globalThis.document = dom.document;
  
  const storage = {};
  globalThis.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => storage[k] = String(v),
    key: (i) => Object.keys(storage)[i],
    get length() { return Object.keys(storage).length; },
    clear: () => { for (const k in storage) delete storage[k]; }
  };
  
  return dom.document;
};

test('The.the: should set global state on body and localStorage', (t) => {
  const dom = setupDOM();
  The.the('theme', 'dark');
  assert.strictEqual(dom.body.getAttribute('data-theme'), 'dark');
  assert.strictEqual(localStorage.getItem('theme'), 'dark');
});

test('The.the: should set scoped state on element and return it', (t) => {
  const dom = setupDOM('<div id="el"></div>');
  const el = dom.querySelector('#el');
  const result = The.the(el, 'active', 'true');
  assert.strictEqual(el.getAttribute('data-active'), 'true');
  assert.strictEqual(result, el);
});

test('The.the: should sync data-text elements', (t) => {
  const dom = setupDOM('<h1 data-text="user"></h1>');
  The.the('user', 'Alice');
  assert.strictEqual(dom.querySelector('h1').textContent, 'Alice');
});

test('The.handshake: should rehydrate state from localStorage', (t) => {
  const dom = setupDOM('<h1 data-text="theme"></h1>');
  localStorage.setItem('theme', 'blue');
  
  The.handshake();
  
  assert.strictEqual(dom.body.getAttribute('data-theme'), 'blue');
  assert.strictEqual(dom.querySelector('h1').textContent, 'blue');
});

test('The.the: should handle object assignments', (t) => {
  const dom = setupDOM('<div id="el"></div>');
  const el = dom.querySelector('#el');
  The.the(el, { selected: 'true', hidden: 'false' });
  assert.strictEqual(el.getAttribute('aria-selected'), 'true');
  assert.strictEqual(el.getAttribute('aria-hidden'), 'false');
});

test('The._t: should manage a dictionary and populate data-i18n', (t) => {
  const dom = setupDOM('<span data-i18n="save"></span>');
  The.dictionary = { save: 'Save Changes' };
  The._t(); 
  assert.strictEqual(dom.querySelector('span').textContent, 'Save Changes');
});
