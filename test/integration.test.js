import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import The from "../src/core/The.js";
import { $, $$, _t, on, the, route } from "../src/core/index.js";

const setupDOM = (html = "") => {
	const dom = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
	globalThis.document = dom.document;
	globalThis.Node = dom.Node;
	globalThis.CustomEvent = dom.CustomEvent;
	globalThis.HTMLElement = dom.HTMLElement;
	globalThis.HTMLFormElement = dom.HTMLFormElement;
	globalThis.FormData = dom.FormData;
	globalThis.window = dom.window;

	Object.defineProperty(globalThis, "navigator", {
		value: { language: "en-US" },
		configurable: true,
		writable: true,
	});

	globalThis.window.location = {
		pathname: "/",
		search: "",
		hash: "",
		origin: "http://localhost",
		href: "http://localhost/",
	};

	globalThis.window.history = {
		pushState: (_state, _title, url) => {
			const u = new URL(url, "http://localhost");
			globalThis.window.location.href = u.href;
			globalThis.window.location.pathname = u.pathname;
			globalThis.window.location.search = u.search;
			globalThis.window.location.hash = u.hash;
		},
	};

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

test("Integration: The Full Lifecycle (Strict Clone)", async (_t_context) => {
	const dom = setupDOM(`
		<template id="item-tmp">
			<li data-item aria-checked="false">
				<span data-text="task"></span>
				<span data-i18n="static_label">Task:</span>
				<button data-action="toggle" type="button">Check</button>
			</li>
		</template>
		<ul id="list"></ul>
	`);

	The.dictionary = { static_label: "Task:" };
	let mountedCalled = false;

	on(dom.body, "mounted", "[data-item]", () => {
		mountedCalled = true;
	});

	// 1. Clone & Auto-Hydrate i18n
	const el = $.clone("#list", "#item-tmp");
	assert.strictEqual($(el, '[data-i18n="static_label"]').textContent, "Task:");
	assert.ok(dom.getElementById("list").contains(el));
	assert.ok(mountedCalled);

	// 2. State Injection & Reactivity
	the(el, "task", "Finish Project");
	assert.strictEqual($(el, '[data-text="task"]').textContent, "Finish Project");
});

test("Integration: Form Extraction (Advanced)", async (_t_context) => {
	const dom = setupDOM(`
		<form id="my-form">
			<input name="user[name]" value="John">
			<input name="user[email]" value="john@example.com">
			<input name="tags[]" value="web">
			<input name="tags[]" value="cool">
			<input name="simple" value="flat">
		</form>
	`);

	const form = dom.getElementById("my-form");
	const data = the.form(form);

	assert.deepStrictEqual(data, {
		user: {
			name: "John",
			email: "john@example.com",
		},
		tags: ["web", "cool"],
		simple: "flat",
	});
});

test("Integration: Surgical Router", async (_t_context) => {
	const dom = setupDOM(`
		<nav>
			<a href="/about" id="about-link">About</a>
			<a href="#section" id="hash-link">Hash</a>
			<a href="https://google.com" id="ext-link">External</a>
		</nav>
	`);

	let currentPath = "";
	route((path) => {
		currentPath = path;
	});

	// Initial
	assert.strictEqual(currentPath, "/");

	// Internal Link
	dom.getElementById("about-link").click();
	assert.strictEqual(currentPath, "/about");

	// External Link (should NOT trigger route)
	currentPath = "unchanged";
	dom.getElementById("ext-link").click();
	assert.strictEqual(currentPath, "unchanged");
});

test("Integration: Namespace Storage", async (_t_context) => {
	setupDOM(`
		<div data-text="theme"></div>
	`);

	localStorage.clear();
	the("theme", "dark");

	assert.strictEqual(localStorage.getItem("otm:theme"), "dark");
	assert.strictEqual(localStorage.getItem("theme"), null);
});
