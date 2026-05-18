import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import The from "../src/core/The.js";

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

test("import: index.js has no top-level boot or ready assignment", async (_t) => {
	const { readFile } = await import("node:fs/promises");
	const src = await readFile(
		new URL("../src/core/index.js", import.meta.url),
		"utf8",
	);
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
