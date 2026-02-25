import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import The from "../src/core/The.js";

const setupDOM = (html = "") => {
	const dom = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
	globalThis.document = dom.document;
	globalThis.Node = dom.Node;

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

	// Mock fetch
	globalThis.fetch = async (url) => {
		if (url.includes("en.json")) {
			return {
				ok: true,
				json: async () => ({ fetched: "success" }),
			};
		}
		return { ok: false };
	};

	return dom.document;
};

test("The.the: should act as a getter for global state", (_t) => {
	const dom = setupDOM();
	dom.body.setAttribute("data-theme", "dark");
	assert.strictEqual(The.the("theme"), "dark");
});

test("The.the: should act as a getter for scoped state", (_t) => {
	const dom = setupDOM('<div id="el" aria-selected="true"></div>');
	const el = dom.querySelector("#el");
	assert.strictEqual(The.the(el, "selected"), "true");
});

test("The.the: should handle aria mapping in getters", (_t) => {
	const dom = setupDOM();
	dom.body.setAttribute("aria-expanded", "true");
	assert.strictEqual(The.the("expanded"), "true");
});

test("The.the: should set global state on body and localStorage", (_t) => {
	const dom = setupDOM();
	The.the("theme", "dark");
	assert.strictEqual(dom.body.getAttribute("data-theme"), "dark");
	assert.strictEqual(localStorage.getItem("theme"), "dark");
});

test("The.the: should set multiple global states when passing an object", (_t) => {
	const dom = setupDOM();
	The.the({ theme: "light", layout: "grid" });
	assert.strictEqual(dom.body.getAttribute("data-theme"), "light");
	assert.strictEqual(localStorage.getItem("theme"), "light");
	assert.strictEqual(dom.body.getAttribute("data-layout"), "grid");
	assert.strictEqual(localStorage.getItem("layout"), "grid");
});

test("The.the: should sync data-text elements", (_t) => {
	const dom = setupDOM('<h1 data-text="user"></h1>');
	The.the("user", "Alice");
	assert.strictEqual(dom.querySelector("h1").textContent, "Alice");
});

test("The.handshake: should rehydrate state from localStorage", async (_t) => {
	const dom = setupDOM('<h1 data-text="theme"></h1>');
	localStorage.setItem("theme", "blue");
	await The.handshake();
	assert.strictEqual(dom.body.getAttribute("data-theme"), "blue");
});

test("The.handshake: should fetch dictionary if meta tag is present", async (_t) => {
	setupDOM('<meta name="i18n" content="/locales" data-available="en">');
	The.dictionary = {};
	await The.handshake();
	assert.strictEqual(The.dictionary.fetched, "success");
});

test("The.the: should handle object assignments", (_t) => {
	const dom = setupDOM('<div id="el"></div>');
	const el = dom.querySelector("#el");
	The.the(el, { selected: "true", hidden: "false" });
	assert.strictEqual(el.getAttribute("aria-selected"), "true");
	assert.strictEqual(el.getAttribute("aria-hidden"), "false");
});

test("The._t: should manage a dictionary and populate data-i18n", (_t) => {
	const dom = setupDOM('<span data-i18n="save"></span>');
	The.dictionary = { save: "Save Changes" };
	The._t();
	assert.strictEqual(dom.querySelector("span").textContent, "Save Changes");
});
