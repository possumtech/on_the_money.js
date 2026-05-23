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

test("Linter.crossCheck: HTML-101 catches orphan templates", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source:
				'<template id="orphan"></template><template id="used"></template>',
			dicts: [],
		},
	];
	const jsSources = [
		{ file: "a.js", source: 'const el = $.clone("#parent", "#used");' },
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources });
	const orphans = violations.filter((v) => v.ruleId === "HTML-101");
	assert.strictEqual(orphans.length, 1);
	assert.match(orphans[0].message, /orphan/i);
	assert.match(orphans[0].message, /"orphan"/);
});

test("Linter.crossCheck: HTML-101 ignored when both templates are used", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source: '<template id="a"></template><template id="b"></template>',
			dicts: [],
		},
	];
	const jsSources = [
		{
			file: "a.js",
			source: '$.clone("#x", "#a"); $.clone("#y", "#b");',
		},
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources });
	const orphans = violations.filter((v) => v.ruleId === "HTML-101");
	assert.strictEqual(orphans.length, 0);
});

test("Linter.crossCheck: HTML-102 catches data-i18n keys missing from locale dicts", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source:
				'<span data-i18n="known"></span><span data-i18n="missing"></span>',
			dicts: [
				{ locale: "en", dict: { known: "Hi" } },
				{ locale: "es", dict: { known: "Hola" } },
			],
		},
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources: [] });
	const missing = violations.filter((v) => v.ruleId === "HTML-102");
	assert.strictEqual(missing.length, 1);
	assert.match(missing[0].message, /"missing"/);
});

test("Linter.crossCheck: HTML-103 catches placeholder token mismatch", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source:
				'<span data-i18n="greet" data-i18n-name="X" data-i18n-extra="Y"></span>',
			dicts: [{ locale: "en", dict: { greet: "Hello, {name}!" } }],
		},
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources: [] });
	const mismatch = violations.filter((v) => v.ruleId === "HTML-103");
	assert.strictEqual(mismatch.length, 1);
	assert.match(mismatch[0].message, /extra/);
});

test("Linter.crossCheck: HTML-102/103 skipped when dicts empty", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source: '<span data-i18n="anykey"></span>',
			dicts: [],
		},
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources: [] });
	assert.strictEqual(violations.length, 0);
});
