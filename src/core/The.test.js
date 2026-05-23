import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import The from "./The.js";
import { the } from "./index.js";

const setupDOM = (html = "") => {
	const dom = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
	globalThis.document = dom.document;
	globalThis.Node = dom.Node;
	globalThis.Element = dom.Element;

	const storage = {};
	globalThis.localStorage = {
		getItem: (k) => storage[k] || null,
		setItem: (k, v) => {
			storage[k] = String(v);
		},
		key: (i) => Object.keys(storage)[i],
		get length() {
			return Object.keys(storage).length;
		},
		clear: () => {
			for (const k in storage) delete storage[k];
		},
	};

	globalThis.fetch = async (url) => {
		if (url.includes("en.json")) {
			return {
				ok: true,
				json: async () => ({ fetched: "success" }),
			};
		}
		return { ok: false };
	};

	return dom;
};

test("the(key): reads global state from body", (_t) => {
	const { document } = setupDOM();
	document.body.setAttribute("data-theme", "dark");
	assert.strictEqual(The.the("theme"), "dark");
});

test("the(el, key): reads scoped state from element", (_t) => {
	const { document } = setupDOM('<div id="el" aria-selected="true"></div>');
	const el = document.querySelector("#el");
	assert.strictEqual(The.the(el, "selected"), "true");
});

test("the(key): maps aria keys for getters", (_t) => {
	const { document } = setupDOM();
	document.body.setAttribute("aria-expanded", "true");
	assert.strictEqual(The.the("expanded"), "true");
});

test("the(key, val): writes body attr + otm: localStorage", (_t) => {
	const { document } = setupDOM();
	The.the("theme", "dark");
	assert.strictEqual(document.body.getAttribute("data-theme"), "dark");
	assert.strictEqual(localStorage.getItem("otm:theme"), "dark");
});

test("the({k:v}): batch-sets global state", (_t) => {
	const { document } = setupDOM();
	The.the({ theme: "light", layout: "grid" });
	assert.strictEqual(document.body.getAttribute("data-theme"), "light");
	assert.strictEqual(localStorage.getItem("otm:theme"), "light");
	assert.strictEqual(document.body.getAttribute("data-layout"), "grid");
	assert.strictEqual(localStorage.getItem("otm:layout"), "grid");
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

test("the(el, key): aria mapping covers extended set", (_t) => {
	const { document } = setupDOM('<input id="el">');
	const el = document.querySelector("#el");
	The.the(el, { invalid: true, required: true, readonly: false });
	assert.strictEqual(el.getAttribute("aria-invalid"), "true");
	assert.strictEqual(el.getAttribute("aria-required"), "true");
	assert.strictEqual(el.getAttribute("aria-readonly"), "false");
	assert.strictEqual(The.the(el, "invalid"), "true");
});

test("the(el, key): pressed and current also map to aria-*", (_t) => {
	const { document } = setupDOM('<button id="b"></button><a id="a"></a>');
	const btn = document.querySelector("#b");
	const link = document.querySelector("#a");
	The.the(btn, "pressed", true);
	The.the(link, "current", "page");
	assert.strictEqual(btn.getAttribute("aria-pressed"), "true");
	assert.strictEqual(link.getAttribute("aria-current"), "page");
});

test("the.title(str): sets document.title and returns the title element", (_t) => {
	const { document } = setupDOM("<title>old</title>");
	const out = The.title("new page");
	assert.strictEqual(document.title, "new page");
	assert.strictEqual(out, document.querySelector("title"));
});

test("the.attr(el, name, val): writes a single attribute", (_t) => {
	const { document } = setupDOM('<a id="x"></a>');
	const el = document.querySelector("#x");
	const out = The.attr(el, "href", "/users/alice");
	assert.strictEqual(el.getAttribute("href"), "/users/alice");
	assert.strictEqual(out, el);
});

test("the.attr(el, obj): batch-writes multiple attributes", (_t) => {
	const { document } = setupDOM('<a id="x"></a>');
	const el = document.querySelector("#x");
	The.attr(el, { href: "/x", rel: "author", tabindex: "0" });
	assert.strictEqual(el.getAttribute("href"), "/x");
	assert.strictEqual(el.getAttribute("rel"), "author");
	assert.strictEqual(el.getAttribute("tabindex"), "0");
});

test("the.attr: throws on unrecognized second arg", (_t) => {
	const { document } = setupDOM('<a id="x"></a>');
	const el = document.querySelector("#x");
	assert.throws(() => The.attr(el, 42), /string or plain object/);
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

test("the.boot(): rehydrates otm: localStorage state to body", async (_t) => {
	const { document } = setupDOM('<h1 data-text="theme"></h1>');
	localStorage.setItem("otm:theme", "blue");
	await The.boot();
	assert.strictEqual(document.body.getAttribute("data-theme"), "blue");
	assert.strictEqual(document.querySelector("h1").textContent, "blue");
});

test("the.boot(): fetches dictionary when <meta name=i18n> is present", async (_t) => {
	setupDOM('<meta name="i18n" content="/locales" data-available="en">');
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
	await The.boot({ namespace: "myapp" });
	The.the("theme", "dark");
	assert.strictEqual(localStorage.getItem("myapp:theme"), "dark");
	assert.strictEqual(localStorage.getItem("otm:theme"), null);
	The.prefix = "otm:";
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
	await The.boot({ defaultLocale: "en" });
	assert.strictEqual(fetched, true);
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

test("the.boot({ defaultLocale }): still replays localStorage state on skip", async (_t) => {
	const { document } = setupDOM('<h1 data-text="theme"></h1>');
	document.documentElement.setAttribute("lang", "en");
	localStorage.setItem("otm:theme", "blue");
	The.locale = "en-US";
	await The.boot({ defaultLocale: "en" });
	assert.strictEqual(document.body.getAttribute("data-theme"), "blue");
});

test("the.boot({ ephemeralKeys }): keys in the set don't write to localStorage", async (_t) => {
	const { document } = setupDOM();
	await The.boot({ ephemeralKeys: ["modal", "toast"] });
	The.the("modal", "open");
	The.the("theme", "dark");
	assert.strictEqual(document.body.getAttribute("data-modal"), "open");
	assert.strictEqual(document.body.getAttribute("data-theme"), "dark");
	assert.strictEqual(localStorage.getItem("otm:modal"), null);
	assert.strictEqual(localStorage.getItem("otm:theme"), "dark");
	The.ephemeralKeys = new Set();
});

test("the.boot({ ephemeralKeys }): batch form also skips ephemeral", async (_t) => {
	setupDOM();
	await The.boot({ ephemeralKeys: ["modal"] });
	The.the({ modal: "open", theme: "light" });
	assert.strictEqual(localStorage.getItem("otm:modal"), null);
	assert.strictEqual(localStorage.getItem("otm:theme"), "light");
	The.ephemeralKeys = new Set();
});

test("the.boot({ ephemeralKeys }): replay skips persisted ephemeral keys", async (_t) => {
	const { document } = setupDOM();
	localStorage.setItem("otm:modal", "stale");
	localStorage.setItem("otm:theme", "dark");
	await The.boot({ ephemeralKeys: ["modal"] });
	assert.strictEqual(document.body.getAttribute("data-modal"), null);
	assert.strictEqual(document.body.getAttribute("data-theme"), "dark");
	The.ephemeralKeys = new Set();
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
