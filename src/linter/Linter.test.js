import assert from "node:assert";
import test from "node:test";
import Linter from "./Linter.js";

test("Linter.check: non-HTML files return no violations", (_t) => {
	assert.strictEqual(Linter.check("x.js", "el.innerHTML = 'x';").length, 0);
	assert.strictEqual(Linter.check("x.css", "!important;").length, 0);
});

test("Linter.check: HTML-004 catches naked strings", (_t) => {
	const code = "<div>hello</div>";
	const violations = Linter.check("test.html", code);
	const naked = violations.filter((v) => v.ruleId === "HTML-004");
	assert.ok(naked.length >= 1);
});

test("Linter.check: HTML-004 allows data-i18n", (_t) => {
	const code = '<span data-i18n="key">fallback</span>';
	const violations = Linter.check("test.html", code);
	const naked = violations.filter((v) => v.ruleId === "HTML-004");
	assert.strictEqual(naked.length, 0);
});

test("Linter.check: HTML-004 allows leaf-text elements (option, textarea, title)", (_t) => {
	const code =
		"<select><option>English</option></select><textarea>x</textarea><title>X</title>";
	const violations = Linter.check("test.html", code);
	const naked = violations.filter((v) => v.ruleId === "HTML-004");
	assert.strictEqual(naked.length, 0);
});

test("Linter.check: HTML-017 catches data-action on non-semantic element without role", (_t) => {
	const code = '<div data-action="x">click</div>';
	const violations = Linter.check("test.html", code);
	const interactive = violations.filter((v) => v.ruleId === "HTML-017");
	assert.strictEqual(interactive.length, 1);
});

test("Linter.check: HTML-017 allows data-action on button", (_t) => {
	const code = '<button data-action="x">click</button>';
	const violations = Linter.check("test.html", code);
	const interactive = violations.filter((v) => v.ruleId === "HTML-017");
	assert.strictEqual(interactive.length, 0);
});

test("Linter.check: HTML-017 allows data-action with role + tabindex", (_t) => {
	const code = '<div data-action="x" role="button" tabindex="0">click</div>';
	const violations = Linter.check("test.html", code);
	const interactive = violations.filter((v) => v.ruleId === "HTML-017");
	assert.strictEqual(interactive.length, 0);
});

test("Linter.check: HTML-023 catches data-i18n usage without i18n meta", (_t) => {
	const code =
		'<!DOCTYPE html><html lang="en"><body><h1 data-i18n="t"></h1></body></html>';
	const violations = Linter.check("test.html", code);
	const missing = violations.filter((v) => v.ruleId === "HTML-023");
	assert.strictEqual(missing.length, 1);
});

test("Linter.check: HTML-023 satisfied when i18n meta present", (_t) => {
	const code =
		'<!DOCTYPE html><html lang="en"><head><meta name="i18n" content="/locales"></head><body><h1 data-i18n="t"></h1></body></html>';
	const violations = Linter.check("test.html", code);
	const missing = violations.filter((v) => v.ruleId === "HTML-023");
	assert.strictEqual(missing.length, 0);
});

test("Linter.check: HTML-024 catches manifest-folder mismatch", (_t) => {
	const code =
		'<!DOCTYPE html><html lang="en"><head><meta name="i18n" content="/locales" data-available="en"></head><body><h1 data-i18n="t"></h1></body></html>';
	const violations = Linter.check("test.html", code, ["en", "fr"]);
	const mismatch = violations.filter((v) => v.ruleId === "HTML-024");
	assert.strictEqual(mismatch.length, 1);
});

test("Linter.check: HTML-024 satisfied when manifest matches folder", (_t) => {
	const code =
		'<!DOCTYPE html><html lang="en"><head><meta name="i18n" content="/locales" data-available="en,fr"></head><body><h1 data-i18n="t"></h1></body></html>';
	const violations = Linter.check("test.html", code, ["en", "fr"]);
	const mismatch = violations.filter((v) => v.ruleId === "HTML-024");
	assert.strictEqual(mismatch.length, 0);
});

test("Linter.check: HTML-023/024 skipped for fragments (no <html>)", (_t) => {
	const code = '<template><span data-i18n="t"></span></template>';
	const violations = Linter.check("test.html", code);
	const cross = violations.filter(
		(v) => v.ruleId === "HTML-023" || v.ruleId === "HTML-024",
	);
	assert.strictEqual(cross.length, 0);
});
