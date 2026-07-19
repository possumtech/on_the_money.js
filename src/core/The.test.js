import assert from "node:assert";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import The from "./The.js";
import { the } from "./index.js";

test("the(key): reads global state from body", (_t) => {
	const { document } = setupDOM();
	document.body.setAttribute("data-theme", "dark");
	assert.strictEqual(The.the("theme"), "dark");
});

test("the(key): camelCase keys convert to kebab-case attributes", (_t) => {
	const { document } = setupDOM();
	The.the("chapterHasNav", "true");
	assert.strictEqual(
		document.body.getAttribute("data-chapter-has-nav"),
		"true",
	);
	assert.strictEqual(The.the("chapterHasNav"), "true");
});

test("the(key): snake_case keys convert to kebab-case attributes", (_t) => {
	const { document } = setupDOM();
	The.the("chapter_has_nav", "true");
	assert.strictEqual(
		document.body.getAttribute("data-chapter-has-nav"),
		"true",
	);
	assert.strictEqual(The.the("chapter_has_nav"), "true");
});

test("the(key): single-word and already-kebab keys pass through", (_t) => {
	const { document } = setupDOM();
	The.the("theme", "dark");
	The.the("data-foo", "bar");
	assert.strictEqual(document.body.getAttribute("data-theme"), "dark");
});

test("the(key): ARIA shortcut keys still map correctly under kebab conversion", (_t) => {
	const { document } = setupDOM('<button id="b"></button>');
	const el = document.querySelector("#b");
	The.the(el, "expanded", true);
	assert.strictEqual(el.getAttribute("aria-expanded"), "true");
});

test("the.match: extracts named segments", (_t) => {
	setupDOM();
	const out = The.match(
		"/@:user/:work/:chapter",
		"/@alice/great-work/chapter-1",
	);
	assert.deepStrictEqual(out, {
		user: "alice",
		work: "great-work",
		chapter: "chapter-1",
	});
});

test("the.match: returns null when pattern doesn't match", (_t) => {
	setupDOM();
	assert.strictEqual(The.match("/@:user/:work", "/no-at-sign/here"), null);
});

test("the.match: decodes URI-encoded segments", (_t) => {
	setupDOM();
	const out = The.match("/@:user", "/@alice%20bob");
	assert.strictEqual(out.user, "alice bob");
});

test("the.match: single segment", (_t) => {
	setupDOM();
	const out = The.match("/:slug", "/about");
	assert.deepStrictEqual(out, { slug: "about" });
});

test("the.match: trailing slash mismatch returns null", (_t) => {
	setupDOM();
	assert.strictEqual(The.match("/:slug", "/about/"), null);
});

test("the(el, key): reads scoped state from element", (_t) => {
	const { document } = setupDOM('<div id="el" aria-selected="true"></div>');
	const el = document.querySelector("#el");
	assert.strictEqual(The.the(el, "selected"), "true");
});

test("the(key): aria-named keys are data-* at global scope", (_t) => {
	const { document } = setupDOM();
	The.the("hidden", true);
	assert.strictEqual(document.body.getAttribute("data-hidden"), "true");
	assert.strictEqual(document.body.getAttribute("aria-hidden"), null);
	assert.strictEqual(The.the("hidden"), "true");
});

test("the(key, null): deletes the attribute and clears [data-text] mirrors", (_t) => {
	const { document } = setupDOM('<span data-text="modal">old</span>');
	The.the("modal", "session-expired");
	assert.strictEqual(
		document.body.getAttribute("data-modal"),
		"session-expired",
	);
	The.the("modal", null);
	assert.strictEqual(document.body.getAttribute("data-modal"), null);
	assert.strictEqual(document.querySelector("span").textContent, "");
});

test("the(key, null): removes the persisted localStorage entry", (_t) => {
	setupDOM();
	The.persistKeys = new Set(["theme"]);
	The.the("theme", "dark");
	assert.strictEqual(localStorage.getItem("otm:theme"), "dark");
	The.the("theme", null);
	assert.strictEqual(localStorage.getItem("otm:theme"), null);
	The.persistKeys = new Set();
});

test("the(el, {k:v}): projects into descendant data-bind attributes", (_t) => {
	const { document } = setupDOM(
		'<article id="card"><a data-text="name" data-bind="href:profile-url">@x</a></article>',
	);
	const card = document.querySelector("#card");
	The.the(card, { name: "@alice", profileUrl: "/@alice" });
	const a = document.querySelector("a");
	assert.strictEqual(a.textContent, "@alice");
	assert.strictEqual(a.getAttribute("href"), "/@alice");
});

test("the(key, val): global writes project into data-bind document-wide", (_t) => {
	const { document } = setupDOM(
		'<a data-bind="href:docs-url" data-i18n="docs">Docs</a>',
	);
	The.the("docs-url", "/docs/v2");
	assert.strictEqual(
		document.querySelector("a").getAttribute("href"),
		"/docs/v2",
	);
});

test("data-bind: multiple pairs on one element; null removes only the bound attr", (_t) => {
	const { document } = setupDOM(
		'<time id="t" data-bind="datetime:at title:at-label"></time>',
	);
	const el = document.querySelector("#t");
	The.the({ at: "2026-07-19", atLabel: "July" });
	assert.strictEqual(el.getAttribute("datetime"), "2026-07-19");
	assert.strictEqual(el.getAttribute("title"), "July");
	The.the("at", null);
	assert.strictEqual(el.getAttribute("datetime"), null);
	assert.strictEqual(el.getAttribute("title"), "July");
});

test("data-bind: substring keys do not false-apply", (_t) => {
	const { document } = setupDOM('<a id="a" data-bind="href:subtitle"></a>');
	The.the("title", "X");
	assert.strictEqual(document.querySelector("#a").getAttribute("href"), null);
});

test("data-bind: self-element binding applies on scoped writes", (_t) => {
	const { document } = setupDOM('<a id="a" data-bind="href:link"></a>');
	const a = document.querySelector("#a");
	The.the(a, "link", "/x");
	assert.strictEqual(a.getAttribute("href"), "/x");
});

test("the(el, key, null): deletes the scoped attribute", (_t) => {
	const { document } = setupDOM('<div id="el"></div>');
	const el = document.querySelector("#el");
	The.the(el, "active", "yes");
	The.the(el, "active", null);
	assert.strictEqual(el.getAttribute("data-active"), null);
});

test("the({k: null}): batch write deletes null-valued keys", (_t) => {
	const { document } = setupDOM();
	The.the({ a: "1", b: "2" });
	The.the({ a: null, b: "3" });
	assert.strictEqual(document.body.getAttribute("data-a"), null);
	assert.strictEqual(document.body.getAttribute("data-b"), "3");
});

test("the(key, val): writes body attr; persists only if key in persistKeys", (_t) => {
	const { document } = setupDOM();
	The.persistKeys = new Set(["theme"]);
	The.the("theme", "dark");
	The.the("modal", "open");
	assert.strictEqual(document.body.getAttribute("data-theme"), "dark");
	assert.strictEqual(document.body.getAttribute("data-modal"), "open");
	assert.strictEqual(localStorage.getItem("otm:theme"), "dark");
	assert.strictEqual(localStorage.getItem("otm:modal"), null);
	The.persistKeys = new Set();
});

test("the({k:v}): batch global write; persistence follows persistKeys", (_t) => {
	const { document } = setupDOM();
	The.persistKeys = new Set(["theme"]);
	The.the({ theme: "light", layout: "grid" });
	assert.strictEqual(document.body.getAttribute("data-theme"), "light");
	assert.strictEqual(localStorage.getItem("otm:theme"), "light");
	assert.strictEqual(document.body.getAttribute("data-layout"), "grid");
	assert.strictEqual(localStorage.getItem("otm:layout"), null);
	The.persistKeys = new Set();
});

test("the(key, val): syncs [data-text] descendants of body", (_t) => {
	const { document } = setupDOM('<h1 data-text="user"></h1>');
	The.the("user", "Alice");
	assert.strictEqual(document.querySelector("h1").textContent, "Alice");
});

test("the(el, {k:v}): batch-sets scoped state with aria mapping", (_t) => {
	const { document } = setupDOM('<div id="el"></div>');
	const el = document.querySelector("#el");
	The.the(el, { selected: "true", hidden: "false" });
	assert.strictEqual(el.getAttribute("aria-selected"), "true");
	assert.strictEqual(el.getAttribute("aria-hidden"), "false");
});

test("the(el, key): ARIA mapping covers the closed widget-state set", (_t) => {
	const { document } = setupDOM('<button id="b"></button>');
	const el = document.querySelector("#b");
	The.the(el, { expanded: true, selected: false });
	assert.strictEqual(el.getAttribute("aria-expanded"), "true");
	assert.strictEqual(el.getAttribute("aria-selected"), "false");
});

test("the(el, key): non-mapped keys write data-*, not aria-*", (_t) => {
	const { document } = setupDOM('<input id="el">');
	const el = document.querySelector("#el");
	The.the(el, "invalid", "true");
	assert.strictEqual(el.getAttribute("data-invalid"), "true");
	assert.strictEqual(el.getAttribute("aria-invalid"), null);
});

test("the(key, val): global slot hydration walks head too (title etc.)", (_t) => {
	const dom = setupDOM('<title data-text="title">old</title>');
	The.the("title", "new title");
	assert.strictEqual(
		dom.document.querySelector("title").textContent,
		"new title",
	);
});

test("the(el, key, val): does NOT touch localStorage", (_t) => {
	const { document } = setupDOM('<div id="el"></div>');
	const el = document.querySelector("#el");
	The.the(el, "active", "yes");
	assert.strictEqual(el.getAttribute("data-active"), "yes");
	assert.strictEqual(localStorage.getItem("otm:active"), null);
});

test("the(): set returns the affected element", (_t) => {
	const { document } = setupDOM('<div id="el"></div>');
	assert.strictEqual(The.the("theme", "dark"), document.body);
	const el = document.querySelector("#el");
	assert.strictEqual(The.the(el, "active", "yes"), el);
	assert.strictEqual(The.the({ a: "1", b: "2" }), document.body);
	assert.strictEqual(The.the(el, { a: "1" }), el);
});

test("the(string, undefined): throws per fail-hard", (_t) => {
	setupDOM();
	assert.throws(() => The.the("theme", undefined), /val is required for set/);
});

test("the(): no args throws", (_t) => {
	setupDOM();
	assert.throws(() => The.the(), /missing args/);
});

test("the(form): no longer polymorphic — routes to global path and throws", (_t) => {
	const { document } = setupDOM(
		'<form id="f"><input name="x" value="1"></form>',
	);
	const form = document.querySelector("#f");
	assert.throws(() => The.the(form), /unrecognized call shape/);
});

test("the.form(formEl): extracts named controls into nested object", (_t) => {
	const { document } = setupDOM(`
		<form id="f">
			<input name="task" value="buy milk">
			<input name="user[name]" value="alice">
			<input name="tags[]" value="a">
			<input name="tags[]" value="b">
		</form>
	`);
	const form = document.querySelector("#f");
	const out = The.form(form);
	assert.strictEqual(out.task, "buy milk");
	assert.deepStrictEqual(out.user, { name: "alice" });
	assert.deepStrictEqual(out.tags, ["a", "b"]);
});

test("the.form(formEl): single [] entry still yields an array", (_t) => {
	const { document } = setupDOM(`
		<form id="f">
			<input name="tags[]" value="solo">
		</form>
	`);
	const out = The.form(document.querySelector("#f"));
	assert.deepStrictEqual(out.tags, ["solo"]);
});

test("the.form(formEl): multi-select yields every selected value", (_t) => {
	const { document } = setupDOM(`
		<form id="f">
			<select name="colors[]" multiple>
				<option value="red" selected>Red</option>
				<option value="green">Green</option>
				<option value="blue" selected>Blue</option>
			</select>
		</form>
	`);
	const out = The.form(document.querySelector("#f"));
	assert.deepStrictEqual(out.colors, ["red", "blue"]);
});

test("the.form(formEl): skips file inputs", (_t) => {
	const { document } = setupDOM(`
		<form id="f">
			<input type="file" name="upload" value="fake.pdf">
			<input name="keep" value="yes">
		</form>
	`);
	const out = The.form(document.querySelector("#f"));
	assert.deepStrictEqual(out, { keep: "yes" });
});

test("the.form(formEl): skips disabled, unchecked, and submit controls", (_t) => {
	const { document } = setupDOM(`
		<form id="f">
			<input name="active" value="yes">
			<input name="skip" value="no" disabled>
			<input type="checkbox" name="agreed" value="1" checked>
			<input type="checkbox" name="optional" value="1">
			<input type="submit" name="submit" value="go">
		</form>
	`);
	const form = document.querySelector("#f");
	const out = The.form(form);
	assert.deepStrictEqual(out, { active: "yes", agreed: "1" });
});

test("the.boot(): rehydrates persisted localStorage state to body", async (_t) => {
	const { document } = setupDOM('<h1 data-text="theme"></h1>');
	localStorage.setItem("otm:theme", "blue");
	await The.boot({ persistKeys: ["theme"] });
	assert.strictEqual(document.body.getAttribute("data-theme"), "blue");
	assert.strictEqual(document.querySelector("h1").textContent, "blue");
	The.persistKeys = new Set();
});

test("the.boot(): does NOT rehydrate keys absent from persistKeys", async (_t) => {
	const { document } = setupDOM();
	localStorage.setItem("otm:modal", "stale");
	await The.boot({ persistKeys: ["theme"] });
	assert.strictEqual(document.body.getAttribute("data-modal"), null);
	The.persistKeys = new Set();
});

test("the.boot(): fetches dictionary when <meta name=i18n> is present", async (_t) => {
	setupDOM('<meta name="i18n" content="/locales" data-available="en">');
	globalThis.fetch = async (url) => {
		if (url.includes("en.json"))
			return { ok: true, json: async () => ({ fetched: "success" }) };
		return { ok: false, status: 404 };
	};
	The.dictionary = {};
	await The.boot();
	assert.strictEqual(The.dictionary.fetched, "success");
});

test("the.boot({ dictionary }): uses inline dictionary, skips fetch", async (_t) => {
	setupDOM();
	let fetched = false;
	globalThis.fetch = async () => {
		fetched = true;
		return { ok: true, json: async () => ({}) };
	};
	The.dictionary = {};
	await The.boot({ dictionary: { greeting: "hi" } });
	assert.strictEqual(fetched, false);
	assert.strictEqual(The.dictionary.greeting, "hi");
});

test("the.boot({ dictionary }): loads inline dictionary under the locale short-circuit; hydration still skipped", async (_t) => {
	const dom = setupDOM('<h1 data-i18n="app_title">Source text</h1>');
	dom.document.documentElement.setAttribute("lang", "en");
	let fetched = false;
	globalThis.fetch = async () => {
		fetched = true;
		return { ok: true, json: async () => ({}) };
	};
	The.dictionary = {};
	await The.boot({ dictionary: { app_title: "On The Money" } });
	assert.strictEqual(The.dictionary.app_title, "On The Money");
	assert.strictEqual(fetched, false);
	assert.strictEqual(
		dom.document.querySelector("h1").textContent,
		"Source text",
	);
});

test("the.boot(): failed dictionary fetch warns and falls back to data-fallback file", async (t) => {
	setupDOM(
		'<meta name="i18n" content="/locales" data-available="es,en" data-fallback="en">',
	);
	The.prefix = "otm:";
	localStorage.setItem("otm:lang", "es");
	const warn = t.mock.method(console, "warn", () => {});
	const urls = [];
	globalThis.fetch = async (url) => {
		urls.push(url);
		if (url.includes("es.json")) return { ok: false, status: 404 };
		return { ok: true, json: async () => ({ fetched: "fallback" }) };
	};
	The.dictionary = {};
	await The.boot();
	assert.deepStrictEqual(urls, ["/locales/es.json", "/locales/en.json"]);
	assert.strictEqual(The.dictionary.fetched, "fallback");
	assert.strictEqual(warn.mock.calls.length, 1);
});

test("the.boot({ locales }): overrides meta-tag path", async (_t) => {
	setupDOM();
	let requestedUrl = "";
	globalThis.fetch = async (url) => {
		requestedUrl = url;
		return { ok: true, json: async () => ({ from: "override" }) };
	};
	await The.boot({ locales: "/i18n" });
	assert.match(requestedUrl, /^\/i18n\//);
	assert.strictEqual(The.dictionary.from, "override");
});

test("the.flat: flattens nested objects with default separator", (_t) => {
	const out = The.flat({
		user: { name: "Alice", email: "a@b" },
		tags: ["x", "y"],
	});
	assert.deepStrictEqual(out, {
		user_name: "Alice",
		user_email: "a@b",
		tags_0: "x",
		tags_1: "y",
	});
});

test("the.flat: respects a custom separator", (_t) => {
	const out = The.flat({ a: { b: 1 } }, ".");
	assert.deepStrictEqual(out, { "a.b": 1 });
});

test("the.flat: throws on non-object input", (_t) => {
	assert.throws(() => The.flat("nope"), /must be an object/);
	assert.throws(() => The.flat(null), /must be an object/);
});

test('the(el, k, boolean): coerces to "true"/"false"', (_t) => {
	const { document } = setupDOM('<div id="el"></div>');
	const el = document.querySelector("#el");
	The.the(el, "checked", true);
	assert.strictEqual(el.getAttribute("aria-checked"), "true");
	The.the(el, "checked", false);
	assert.strictEqual(el.getAttribute("aria-checked"), "false");
});

test("the(el, k, boolean): syncs [data-text] with coerced string", (_t) => {
	const { document } = setupDOM(
		'<div id="el"><span data-text="active"></span></div>',
	);
	const el = document.querySelector("#el");
	The.the(el, "active", true);
	assert.strictEqual(el.querySelector("span").textContent, "true");
});

test("the.dictionary: live accessor proxies to The.dictionary", (_t) => {
	setupDOM();
	the.dictionary = { greeting: "hi" };
	assert.strictEqual(The.dictionary.greeting, "hi");
	The.dictionary = { greeting: "bye" };
	assert.strictEqual(the.dictionary.greeting, "bye");
});

test("the.locale: live accessor proxies to The.locale", (_t) => {
	setupDOM();
	the.locale = "fr-FR";
	assert.strictEqual(The.locale, "fr-FR");
	The.locale = "es-ES";
	assert.strictEqual(the.locale, "es-ES");
});

test("the.boot({ namespace }): rewrites localStorage prefix", async (_t) => {
	setupDOM();
	await The.boot({ namespace: "myapp", persistKeys: ["theme"] });
	The.the("theme", "dark");
	assert.strictEqual(localStorage.getItem("myapp:theme"), "dark");
	assert.strictEqual(localStorage.getItem("otm:theme"), null);
	The.prefix = "otm:";
	The.persistKeys = new Set();
});

test("the.boot({ signal }): aborts the fetch", async (_t) => {
	setupDOM('<meta name="i18n" content="/locales" data-available="en">');
	const controller = new AbortController();
	globalThis.fetch = async (_url, opts) => {
		opts?.signal?.throwIfAborted?.();
		throw new DOMException("aborted", "AbortError");
	};
	controller.abort();
	await assert.rejects(The.boot({ signal: controller.signal }));
});

test("the.boot({ defaultLocale }): skips fetch when resolved locale matches", async (_t) => {
	setupDOM('<meta name="i18n" content="/locales" data-available="en">');
	let fetched = false;
	globalThis.fetch = async () => {
		fetched = true;
		return { ok: true, json: async () => ({}) };
	};
	The.dictionary = {};
	The.locale = "en-US";
	await The.boot({ defaultLocale: "en" });
	assert.strictEqual(fetched, false);
});

test("the.boot({ defaultLocale }): fetches when resolved locale differs", async (_t) => {
	setupDOM('<meta name="i18n" content="/locales" data-available="en">');
	localStorage.setItem("otm:lang", "es-ES");
	let fetched = false;
	globalThis.fetch = async () => {
		fetched = true;
		return { ok: true, json: async () => ({ ok: 1 }) };
	};
	The.dictionary = {};
	// "lang" needs to persist for boot to read it back from localStorage
	await The.boot({ defaultLocale: "en", persistKeys: ["lang"] });
	assert.strictEqual(fetched, true);
	The.persistKeys = new Set();
});

test("the.boot(): <html lang> outranks navigator.language in resolution chain", async (_t) => {
	const { document } = setupDOM();
	document.documentElement.setAttribute("lang", "es");
	Object.defineProperty(globalThis, "navigator", {
		value: { language: "en-US" },
		configurable: true,
		writable: true,
	});
	await The.boot();
	assert.strictEqual(The.locale, "es");
});

test("the.boot(): empty <html lang> falls through to navigator.language", async (_t) => {
	setupDOM();
	// document.documentElement.lang is "" by default in setupDOM
	Object.defineProperty(globalThis, "navigator", {
		value: { language: "de-DE" },
		configurable: true,
		writable: true,
	});
	await The.boot();
	assert.strictEqual(The.locale, "de-DE");
});

test("the.boot(): auto-detects <html lang> as default locale", async (_t) => {
	const { document } = setupDOM(
		'<meta name="i18n" content="/locales" data-available="en">',
	);
	document.documentElement.setAttribute("lang", "en");
	let fetched = false;
	globalThis.fetch = async () => {
		fetched = true;
		return { ok: true, json: async () => ({}) };
	};
	The.locale = "en-US";
	await The.boot();
	assert.strictEqual(fetched, false);
});

test("the.boot(): no skip when <html lang> is missing and defaultLocale not passed", async (_t) => {
	setupDOM('<meta name="i18n" content="/locales" data-available="en">');
	let fetched = false;
	globalThis.fetch = async () => {
		fetched = true;
		return { ok: true, json: async () => ({}) };
	};
	The.locale = "en-US";
	await The.boot();
	assert.strictEqual(fetched, true);
});

test("the.boot({ defaultLocale }): still replays persisted state on i18n skip", async (_t) => {
	const { document } = setupDOM('<h1 data-text="theme"></h1>');
	document.documentElement.setAttribute("lang", "en");
	localStorage.setItem("otm:theme", "blue");
	The.locale = "en-US";
	await The.boot({ defaultLocale: "en", persistKeys: ["theme"] });
	assert.strictEqual(document.body.getAttribute("data-theme"), "blue");
	The.persistKeys = new Set();
});

test("the.boot({ persistKeys }): only listed keys persist", async (_t) => {
	const { document } = setupDOM();
	await The.boot({ persistKeys: ["theme"] });
	The.the("theme", "dark");
	The.the("modal", "open");
	assert.strictEqual(document.body.getAttribute("data-theme"), "dark");
	assert.strictEqual(document.body.getAttribute("data-modal"), "open");
	assert.strictEqual(localStorage.getItem("otm:theme"), "dark");
	assert.strictEqual(localStorage.getItem("otm:modal"), null);
	The.persistKeys = new Set();
});

test("the.boot({ persistKeys }): batch form respects allow-list", async (_t) => {
	setupDOM();
	await The.boot({ persistKeys: ["theme"] });
	The.the({ modal: "open", theme: "light" });
	assert.strictEqual(localStorage.getItem("otm:modal"), null);
	assert.strictEqual(localStorage.getItem("otm:theme"), "light");
	The.persistKeys = new Set();
});

test("the.boot({ persistKeys }): replay skips keys absent from allow-list", async (_t) => {
	const { document } = setupDOM();
	localStorage.setItem("otm:modal", "stale");
	localStorage.setItem("otm:theme", "dark");
	await The.boot({ persistKeys: ["theme"] });
	assert.strictEqual(document.body.getAttribute("data-modal"), null);
	assert.strictEqual(document.body.getAttribute("data-theme"), "dark");
	The.persistKeys = new Set();
});

test("import: index.js has no top-level boot or ready assignment", async (_t) => {
	const { readFile } = await import("node:fs/promises");
	const src = await readFile(new URL("./index.js", import.meta.url), "utf8");
	assert.doesNotMatch(
		src,
		/^\s*the\.boot\(/m,
		"the.boot() must not be called at module top level",
	);
	assert.doesNotMatch(
		src,
		/^\s*The\.boot\(/m,
		"The.boot() must not be called at module top level",
	);
	assert.doesNotMatch(
		src,
		/^\s*the\.ready\s*=/m,
		"the.ready must not be assigned at module top level",
	);
});
