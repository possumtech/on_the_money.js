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

test('The.the: should handle object assignments', (t) => {
  const dom = setupDOM('<div id="el"></div>');
  const el = dom.querySelector('#el');
  The.the(el, { a: '1', b: '2' });
  assert.strictEqual(el.getAttribute('data-a'), '1');
  assert.strictEqual(el.getAttribute('data-b'), '2');
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
});

test('The._t: should handle pluralization', (t) => {
  setupDOM();
  The.dictionary = { items: { one: '1 item', other: '{qty} items' } };
  assert.strictEqual(The._t('items', { qty: 1 }), '1 item');
  assert.strictEqual(The._t('items', { qty: 5 }), '5 items');
});

test('The._t: should handle formatting (currency, date, number)', (t) => {
  setupDOM();
  The.dictionary = { 
    price: 'Price: {val}',
    date: 'Date: {val}',
    num: 'Num: {val}'
  };
  const price = The._t('price', { val: 9.99, type: 'currency' });
  const date = The._t('date', { val: '2026-01-01T00:00:00Z', type: 'date' });
  const num = The._t('num', { val: 1000, type: 'number' });
  
  assert.ok(price.includes('9.99'));
  assert.ok(typeof date === 'string' && date.length > 5);
  assert.ok(num.includes('1000') || num.includes('1,000'));
});

test('The._t: should return key if not in dictionary', (t) => {
  setupDOM();
  The.dictionary = {};
  assert.strictEqual(The._t('missing'), 'missing');
});

test('The._t: should hydrate with various attributes', (t) => {
  const dom = setupDOM(`
    <span data-i18n="p" data-i18n-val="10" data-i18n-type="currency"></span>
    <span data-i18n="d" data-i18n-val="2026-02-22T00:00:00Z" data-i18n-type="date"></span>
  `);
  The.dictionary = { p: '{val}', d: '{val}' };
  The._t();
  assert.ok(dom.querySelectorAll('span')[0].textContent.includes('10.00'));
  assert.ok(dom.querySelectorAll('span')[1].textContent.length > 5);
});
