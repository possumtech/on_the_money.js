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

