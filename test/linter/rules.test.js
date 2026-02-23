import test from 'node:test';
import assert from 'node:assert';
import Linter from '../../src/linter/Linter.js';

test('Linter.check: JS-001 - should catch innerHTML assignments', (t) => {
  const code = 'element.innerHTML = "<div>bad</div>";';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, 'JS-001');
});

test('Linter.check: JS-001 - should catch innerHTML on nested objects', (t) => {
  const code = 'document.getElementById("app").innerHTML = "";';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 1);
});

test('Linter.check: JS-001 - should allow normal properties', (t) => {
  const code = 'element.textContent = "good";';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 0);
});

test('Linter.check: JS-003 - should catch direct style assignments', (t) => {
  const code = 'el.style.display = "none";';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, 'JS-003');
});

test('Linter.check: JS-003 - should catch style property deletions', (t) => {
  const code = 'delete el.style.color;';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 1);
});

test('Linter.check: JS-009 - should catch addEventListener', (t) => {
  const code = 'el.addEventListener("click", () => {});';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, 'JS-009');
});

test('Linter.check: JS-011 - should catch dynamic attribute names', (t) => {
  const code = 'el.setAttribute("data-" + key, "value");';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, 'JS-011');
});

test('Linter.check: JS-011 - should allow static attribute names', (t) => {
  const code = 'el.setAttribute("aria-expanded", "true");';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 0);
});

test('Linter.check: JS-015 - should catch textContent assignments', (t) => {
  const code = 'el.textContent = "bad";';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, 'JS-015');
});

test('Linter.check: Unsupported extension should return empty violations', (t) => {
  const violations = Linter.check('test.txt', 'hello');
  assert.strictEqual(violations.length, 0);
});

test('Linter.check: should handle various node properties for coverage', (t) => {
  // code with literals (non-objects), arrays, and nested nodes
  const code = 'const x = [1]; x.push(2); if (true) { []; }'; 
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 0);
});

test('Linter.check: traversal should handle null and non-object values', (t) => {
  // Trigger the !node and typeof node !== 'object' branches in #traverse
  // by providing source that might have such properties in its AST.
  const code = 'var x;';
  const violations = Linter.check('test.js', code);
  assert.strictEqual(violations.length, 0);
});

test('Linter.check: HTML-004 - should catch naked strings in HTML', (t) => {
  const code = '<div>Submit</div>';
  const violations = Linter.check('test.html', code);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, 'HTML-004');
});

test('Linter.check: HTML-004 - should allow empty or whitespace-only tags', (t) => {
  const code = '<div>  </div><div data-i18n="key"></div>';
  const violations = Linter.check('test.html', code);
  assert.strictEqual(violations.length, 0);
});

test('Linter.check: HTML-014 - should catch inline event handlers', (t) => {
  const code = '<button onclick="alert(1)">Click</button>';
  const violations = Linter.check('test.html', code);
  // Should catch 1 for onclick and 1 for naked string "Click"
  assert.ok(violations.some(v => v.ruleId === 'HTML-014'));
  assert.ok(violations.some(v => v.ruleId === 'HTML-004'));
});

test('Linter.check: CSS-006 - should catch !important', (t) => {
  const code = 'div { color: red !important; }';
  const violations = Linter.check('test.css', code);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, 'CSS-006');
});

test('Linter.check: CSS-012 - should catch class selectors', (t) => {
  const code = '.is-active { display: block; }';
  const violations = Linter.check('test.css', code);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, 'CSS-012');
});

test('Linter.check: CSS-012 - should allow attribute selectors', (t) => {
  const code = '[aria-expanded="true"] { display: block; }';
  const violations = Linter.check('test.css', code);
  assert.strictEqual(violations.length, 0);
});

