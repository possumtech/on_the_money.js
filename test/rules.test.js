import assert from "node:assert";
import test from "node:test";
import Linter from "../src/linter/Linter.js";

test("Linter.check: JS-001 - should catch innerHTML assignments", (_t) => {
	const code = 'element.innerHTML = "<div>bad</div>";';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
	assert.strictEqual(violations[0].ruleId, "JS-001");
});

test("Linter.check: JS-001 - should catch innerHTML on nested objects", (_t) => {
	const code = 'document.getElementById("app").innerHTML = "";';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
});

test("Linter.check: JS-001/JS-015 - should allow normal attributes but flag textContent", (_t) => {
	const code = 'element.id = "good";';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 0);
});

test("Linter.check: JS-003 - should catch direct style assignments", (_t) => {
	const code = 'el.style.display = "none";';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
	assert.strictEqual(violations[0].ruleId, "JS-003");
});

test("Linter.check: JS-003 - should catch style property deletions", (_t) => {
	const code = "delete el.style.color;";
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
});

test("Linter.check: JS-009 - should catch addEventListener", (_t) => {
	const code = 'el.addEventListener("click", () => {});';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
	assert.strictEqual(violations[0].ruleId, "JS-009");
});

test("Linter.check: JS-011 - should catch dynamic attribute names", (_t) => {
	const code = 'el.setAttribute("data-" + key, "value");';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
	assert.strictEqual(violations[0].ruleId, "JS-011");
});

test("Linter.check: JS-011 - should allow static attribute names", (_t) => {
	const code = 'el.setAttribute("aria-expanded", "true");';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 0);
});

test("Linter.check: JS-015 - should catch textContent assignments", (_t) => {
	const code = 'el.textContent = "bad";';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
	assert.strictEqual(violations[0].ruleId, "JS-015");
});

test("Linter.check: JS-016 - should catch nested objects in the()", (_t) => {
	const code = 'the("user", { name: "Alice" });';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
	assert.strictEqual(violations[0].ruleId, "JS-016");
});

test("Linter.check: JS-016 - should catch arrays in the()", (_t) => {
	const code = 'the(el, "list", [1, 2, 3]);';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
});

test("Linter.check: JS-016 - should allow flat object assignments to el", (_t) => {
	const code = 'the(el, { name: "Alice", age: 30 });';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 0);
});

test("Linter.check: JS-016 - should catch nested objects in el object assignment", (_t) => {
	const code = 'the(el, { name: "Alice", meta: { color: "red" } });';
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 1);
});

test("Linter.check: JS-019 - should scold click on buttons (prefer form submit)", (_t) => {
	const code = 'on(document, "click", "button", fn);';
	const violations = Linter.check("test.js", code);
	assert.ok(violations.some((v) => v.ruleId === "JS-019"));
});

test("Linter.check: Unsupported extension should return empty violations", (_t) => {
	const violations = Linter.check("test.txt", "hello");
	assert.strictEqual(violations.length, 0);
});

test("Linter.check: should handle various node properties for coverage", (_t) => {
	const code = "const x = [1]; x.push(2); if (true) { []; }";
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 0);
});

test("Linter.check: traversal should handle null and non-object values", (_t) => {
	const code = "var x;";
	const violations = Linter.check("test.js", code);
	assert.strictEqual(violations.length, 0);
});

test("Linter.check: HTML-004 - should catch naked strings in HTML", (_t) => {
	const code =
		'<html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><body><div>Submit</div></body></html>';
	const violations = Linter.check("test.html", code);
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-004").length,
		1,
	);
});

test("Linter.check: HTML-004 - should allow empty or whitespace-only tags", (_t) => {
	const code =
		'<html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><body><div>  </div><div data-i18n="key"></div></body></html>';
	const violations = Linter.check("test.html", code);
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-004").length,
		0,
	);
});

test("Linter.check: HTML-014 - should catch inline event handlers", (_t) => {
	const code = '<button onclick="alert(1)">Click</button>';
	const violations = Linter.check("test.html", code);
	assert.ok(violations.some((v) => v.ruleId === "HTML-014"));
});

test("Linter.check: HTML-017 - should catch data-action on non-interactive without role/tabindex", (_t) => {
	const code = '<div data-action="click"></div>';
	const violations = Linter.check("test.html", code);
	assert.ok(violations.some((v) => v.ruleId === "HTML-017"));
});

test("Linter.check: HTML-017 - should allow data-action if role and tabindex are present", (_t) => {
	const code = '<div data-action="click" role="button" tabindex="0"></div>';
	const violations = Linter.check("test.html", code);
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-017").length,
		0,
	);
});

test("Linter.check: HTML-018 - should catch input without label", (_t) => {
	const code = '<input type="text">';
	const violations = Linter.check("test.html", code);
	assert.ok(violations.some((v) => v.ruleId === "HTML-018"));
});

test("Linter.check: HTML-018 - should ignore hidden inputs", (_t) => {
	const code = '<input type="hidden" name="id">';
	const violations = Linter.check("test.html", code);
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-018").length,
		0,
	);
});

test("Linter.check: HTML-020/021/022 - should catch missing base tags", (_t) => {
	const code = "<html><body></body></html>";
	const violations = Linter.check("test.html", code);
	assert.ok(violations.some((v) => v.ruleId === "HTML-020")); // lang
	assert.ok(violations.some((v) => v.ruleId === "HTML-021")); // charset
	assert.ok(violations.some((v) => v.ruleId === "HTML-022")); // viewport
});

test("Linter.check: HTML-023 - should catch missing otm-i18n meta if data-i18n is used", (_t) => {
	const code =
		'<html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><body><span data-i18n="key"></span></body></html>';
	const violations = Linter.check("test.html", code);
	assert.ok(violations.some((v) => v.ruleId === "HTML-023"));
});

test("Linter.check: CSS-006 - should catch !important", (_t) => {
	const code = "div { color: red !important; }";
	const violations = Linter.check("test.css", code);
	assert.strictEqual(violations.length, 1);
	assert.strictEqual(violations[0].ruleId, "CSS-006");
});

test("Linter.check: CSS-012 - should catch class selectors", (_t) => {
	const code = ".is-active { display: block; }";
	const violations = Linter.check("test.css", code);
	assert.strictEqual(violations.length, 1);
	assert.strictEqual(violations[0].ruleId, "CSS-012");
});

test("Linter.check: CSS-012 - should allow attribute selectors", (_t) => {
	const code = '[aria-expanded="true"] { display: block; }';
	const violations = Linter.check("test.css", code);
	assert.strictEqual(violations.length, 0);
});
