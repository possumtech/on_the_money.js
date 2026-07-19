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

test("Linter.check: HTML-004 allows data-text carriers with fallback text", (_t) => {
	const code = '<strong data-text="user">friend</strong>';
	const violations = Linter.check("test.html", code);
	const naked = violations.filter((v) => v.ruleId === "HTML-004");
	assert.strictEqual(naked.length, 0);
});

test("Linter.check: HTML-004 message names both carriers", (_t) => {
	const violations = Linter.check("test.html", "<div>hello</div>");
	const naked = violations.filter((v) => v.ruleId === "HTML-004");
	assert.match(naked[0].message, /data-i18n="key"/);
	assert.match(naked[0].message, /data-text="key"/);
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

test("Linter.crossCheck: HTML-101 respects data-otm-dynamic opt-out", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source:
				'<template id="dynamic" data-otm-dynamic></template><template id="orphan"></template>',
			dicts: [],
		},
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources: [] });
	const orphans = violations.filter((v) => v.ruleId === "HTML-101");
	assert.strictEqual(orphans.length, 1);
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

test("Linter.crossCheck: HTML-104 catches global/scoped data-text key collision", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source:
				'<template id="card" data-otm-dynamic><h2 data-text="title"></h2></template>',
			dicts: [],
		},
	];
	const jsSources = [{ file: "a.js", source: 'the("title", "My Site");' }];
	const violations = Linter.crossCheck({ htmlSources, jsSources });
	const collisions = violations.filter((v) => v.ruleId === "HTML-104");
	assert.strictEqual(collisions.length, 1);
	assert.match(collisions[0].message, /"title"/);
	assert.match(collisions[0].message, /a\.js:1/);
});

test("Linter.crossCheck: HTML-104 ignores scoped writes and non-template slots", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source:
				'<h1 data-text="title"></h1><template id="card" data-otm-dynamic><h2 data-text="name"></h2></template>',
			dicts: [],
		},
	];
	const jsSources = [
		{ file: "a.js", source: 'the("title", "x"); the(el, "name", "y");' },
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources });
	const collisions = violations.filter((v) => v.ruleId === "HTML-104");
	assert.strictEqual(collisions.length, 0);
});

test("Linter.crossCheck: HTML-104 catches data-bind slot collisions in templates", (_t) => {
	const violations = Linter.crossCheck({
		htmlSources: [
			{
				file: "a.html",
				source:
					'<template id="c" data-otm-dynamic><a data-bind="href:link"></a></template>',
				dicts: [],
			},
		],
		jsSources: [{ file: "a.js", source: 'the("link", "/x");' }],
	});
	const collisions = violations.filter((v) => v.ruleId === "HTML-104");
	assert.strictEqual(collisions.length, 1);
	assert.match(collisions[0].message, /data-bind key "link"/);
});

test("Linter.crossCheck: HTML-106 counts data-bind consumption", (_t) => {
	const violations = Linter.crossCheck({
		htmlSources: [
			{
				file: "a.html",
				source: '<a data-bind="href:profile-url" data-i18n="p">P</a>',
				dicts: [],
			},
		],
		jsSources: [{ file: "a.js", source: 'the("profile-url", "/@a");' }],
	});
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-106").length,
		0,
	);
});

test("Linter.crossCheck: HTML-105 catches dead controls and orphan handlers", (_t) => {
	const htmlSources = [
		{
			file: "a.html",
			source: '<button data-action="save" data-i18n="s">Save</button>',
			dicts: [],
		},
	];
	const jsSources = [
		{
			file: "a.js",
			source: `on("main", "click", '[data-action="ghost"]', fn);`,
		},
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources });
	const dead = violations.filter(
		(v) => v.ruleId === "HTML-105" && /dead control/.test(v.message),
	);
	const orphan = violations.filter(
		(v) => v.ruleId === "HTML-105" && /orphan handler/.test(v.message),
	);
	assert.strictEqual(dead.length, 1);
	assert.match(dead[0].message, /"save"/);
	assert.strictEqual(orphan.length, 1);
	assert.match(orphan[0].message, /"ghost"/);
});

test("Linter.crossCheck: HTML-105 satisfied by matching handler; wildcard dispatch waives dead-control check", (_t) => {
	const matched = Linter.crossCheck({
		htmlSources: [
			{
				file: "a.html",
				source: '<button data-action="save" data-i18n="s">Save</button>',
				dicts: [],
			},
		],
		jsSources: [
			{ file: "a.js", source: `on("m", "click", '[data-action="save"]', f);` },
		],
	});
	assert.strictEqual(matched.filter((v) => v.ruleId === "HTML-105").length, 0);

	const wildcard = Linter.crossCheck({
		htmlSources: [
			{
				file: "a.html",
				source: '<button data-action="anything" data-i18n="s">Go</button>',
				dicts: [],
			},
		],
		jsSources: [
			{ file: "a.js", source: `on("m", "click", "[data-action]", f);` },
		],
	});
	assert.strictEqual(wildcard.filter((v) => v.ruleId === "HTML-105").length, 0);
});

test("Linter.crossCheck: HTML-106 warns on unconsumed global keys; CSS consumption satisfies it", (_t) => {
	const jsSources = [{ file: "a.js", source: 'the("theme", "dark");' }];

	const unconsumed = Linter.crossCheck({ htmlSources: [], jsSources });
	const warns = unconsumed.filter((v) => v.ruleId === "HTML-106");
	assert.strictEqual(warns.length, 1);
	assert.strictEqual(warns[0].severity, "warn");
	assert.match(warns[0].message, /"theme"/);

	const consumed = Linter.crossCheck({
		htmlSources: [],
		jsSources,
		cssSources: [
			{ file: "a.css", source: 'body[data-theme="dark"] { color: red }' },
		],
	});
	assert.strictEqual(consumed.filter((v) => v.ruleId === "HTML-106").length, 0);
});

test("Linter.crossCheck: HTML-106 counts MutationObserver attributeFilter as consumption", (_t) => {
	const violations = Linter.crossCheck({
		htmlSources: [],
		jsSources: [
			{
				file: "a.js",
				source:
					'the("modal", "x"); observer.observe(document.body, { attributeFilter: ["data-modal"] });',
			},
		],
	});
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-106").length,
		0,
	);
});

test("Linter.crossCheck: HTML-107 flags a reveal span with no state-CSS rule", (_t) => {
	const violations = Linter.crossCheck({
		htmlSources: [
			{
				file: "a.html",
				source: '<small data-error-key="not-found" data-i18n="e">Gone</small>',
				dicts: [],
			},
		],
		jsSources: [],
	});
	const parity = violations.filter((v) => v.ruleId === "HTML-107");
	assert.strictEqual(parity.length, 1);
	assert.match(parity[0].message, /can never show/);
	assert.match(parity[0].message, /\[data-error="not-found"\]/);
});

test("Linter.crossCheck: HTML-107 satisfied when both halves exist", (_t) => {
	const violations = Linter.crossCheck({
		htmlSources: [
			{
				file: "a.html",
				source: '<small data-error-key="not-found" data-i18n="e">Gone</small>',
				dicts: [],
			},
		],
		jsSources: [],
		cssSources: [
			{
				file: "a.css",
				source:
					'body[data-error="not-found"] [data-error-key="not-found"] { display: block }',
			},
		],
	});
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-107").length,
		0,
	);
});

test("Linter.crossCheck: HTML-107 flags dead CSS wiring with no span", (_t) => {
	const violations = Linter.crossCheck({
		htmlSources: [],
		jsSources: [],
		cssSources: [
			{
				file: "a.css",
				source: '[data-error-key="gone"] { display: block }',
			},
		],
	});
	const parity = violations.filter((v) => v.ruleId === "HTML-107");
	assert.strictEqual(parity.length, 1);
	assert.match(parity[0].message, /dead wiring/);
});

test("Linter.crossCheck: HTML-107 ignores data-i18n-* params and honors data-otm-dynamic", (_t) => {
	const violations = Linter.crossCheck({
		htmlSources: [
			{
				file: "a.html",
				source:
					'<span data-i18n="greet" data-i18n-key="x">Hi</span><small data-error-key="late" data-otm-dynamic data-i18n="l">L</small>',
				dicts: [],
			},
		],
		jsSources: [],
		cssSources: [
			{ file: "a.css", source: '[data-error-key="late"] { display: block }' },
		],
	});
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-107").length,
		0,
	);
});

test("Linter.crossCheck: HTML-101 recognizes cloneEach references", (_t) => {
	const htmlSources = [
		{ file: "a.html", source: '<template id="row"></template>', dicts: [] },
	];
	const jsSources = [
		{ file: "a.js", source: '$.cloneEach("#list", "#row", items, fn);' },
	];
	const violations = Linter.crossCheck({ htmlSources, jsSources });
	assert.strictEqual(
		violations.filter((v) => v.ruleId === "HTML-101").length,
		0,
	);
});
