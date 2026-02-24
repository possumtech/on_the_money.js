import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import The from "../src/core/The.js";
import { $, $$, _t, on, the } from "../src/core/index.js";

const setupDOM = (html = "") => {
	const dom = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
	globalThis.document = dom.document;
	globalThis.Node = dom.Node;
	globalThis.CustomEvent = dom.CustomEvent;
	globalThis.window = dom.window;

	Object.defineProperty(globalThis, "navigator", {
		value: { language: "en-US" },
		configurable: true,
	});

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

	return dom.document;
};

test("Integration: The Full Lifecycle", async (_t_context) => {
	const dom = setupDOM(`
		<template id="item-tmp">
			<li data-item aria-checked="false">
				<span data-text="task"></span>
				<span data-i18n="static_label"></span>
				<button data-action="toggle" type="button">Check</button>
			</li>
		</template>
		<ul id="list"></ul>
	`);

	The.dictionary = { static_label: "Task:" };
	let eventCaught = false;

	on(dom.body, "click", '[data-action="toggle"]', (e, target) => {
		eventCaught = true;
		const item = target.closest("[data-item]");
		the(item, "checked", "true");
	});

	// 1. Clone & Auto-Hydrate i18n
	const el = $.clone("#item-tmp");
	assert.strictEqual($(el, '[data-i18n="static_label"]').textContent, "Task:");

	// 2. State Injection & Reactivity
	the(el, "task", "Finish Project");
	assert.strictEqual($(el, '[data-text="task"]').textContent, "Finish Project");

	// 3. Mounting
	$("#list").appendChild(el);

	// 4. Event Delegation & Scoped State
	$(el, '[data-action="toggle"]').click();
	assert.ok(eventCaught);
	assert.strictEqual(el.getAttribute("aria-checked"), "true");
});

test("Integration: Advanced I18n Handshake", async (_t_context) => {
	setupDOM(`
		<meta name="i18n" content="/locales" data-available="en">
		<div id="price" data-i18n="price_tag" data-i18n-val="100" data-i18n-type="currency"></div>
	`);

	globalThis.fetch = async () => ({
		ok: true,
		json: async () => ({ price_tag: "Total: {val}" }),
	});

	// Explicitly await handshake
	await The.handshake();

	assert.ok($("#price").textContent.includes("100.00"));
});

test("Integration: Scoped vs Global Reactivity", async (_t_context) => {
	setupDOM(`
		<div id="scope-a"><span data-text="name"></span></div>
		<div id="scope-b"><span data-text="name"></span></div>
	`);

	// Global update
	the("name", "Global");
	assert.strictEqual($("#scope-a span").textContent, "Global");
	assert.strictEqual($("#scope-b span").textContent, "Global");

	// Scoped update
	the($("#scope-a"), "name", "Local A");
	assert.strictEqual($("#scope-a span").textContent, "Local A");
	assert.strictEqual($("#scope-b span").textContent, "Global");
});
