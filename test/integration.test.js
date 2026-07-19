import assert from "node:assert";
import test from "node:test";
import The from "../src/core/The.js";
import { $, $$, _t, on, route, the } from "../src/core/index.js";
import { setupDOM } from "../src/test/index.js";

test("Integration: The Full Lifecycle (Strict Clone)", async (_t_context) => {
	const { document: dom } = setupDOM(`
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
	const { document: dom } = setupDOM(`
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
	const { document: dom } = setupDOM(`
		<nav>
			<a href="/about" id="about-link">About</a>
			<a href="#section" id="hash-link">Hash</a>
			<a href="https://google.com" id="ext-link">External</a>
		</nav>
	`);

	let currentPath = "";
	const off = route((path) => {
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

	off();
});

test("Integration: Router ignores modified clicks and download links", async (_t_context) => {
	const { document: dom } = setupDOM(`
		<a href="/about" id="about-link">About</a>
		<a href="/file.pdf" id="dl-link" download>File</a>
	`);

	let calls = 0;
	const off = route(() => {
		calls++;
	});
	assert.strictEqual(calls, 1);

	const modified = new CustomEvent("click", {
		bubbles: true,
		cancelable: true,
	});
	modified.metaKey = true;
	dom.getElementById("about-link").dispatchEvent(modified);
	assert.strictEqual(calls, 1);

	dom.getElementById("dl-link").click();
	assert.strictEqual(calls, 1);

	off();
});

test("Integration: Router treats same-URL clicks as no-ops", async (_t_context) => {
	const { document: dom } = setupDOM('<a href="/" id="self-link">Home</a>');

	let calls = 0;
	const off = route(() => {
		calls++;
	});
	assert.strictEqual(calls, 1);

	dom.getElementById("self-link").click();
	assert.strictEqual(calls, 1);

	off();
});

test("Integration: Router unsubscribe detaches; re-registration works; double-registration throws", async (_t_context) => {
	const { document: dom } = setupDOM(
		'<a href="/about" id="about-link">About</a>',
	);

	let calls = 0;
	const off = route(() => {
		calls++;
	});
	assert.strictEqual(calls, 1);
	assert.throws(() => route(() => {}), /already active/);

	off();
	dom.getElementById("about-link").click();
	assert.strictEqual(calls, 1);

	const off2 = route(() => {
		calls++;
	});
	assert.strictEqual(calls, 2);
	off2();
});

test("Integration: Router match option intercepts only matching links", async (_t_context) => {
	const { document: dom } = setupDOM(`
		<a href="/instant" id="fast-link" data-route>Instant</a>
		<a href="/normal" id="slow-link">Normal</a>
	`);

	let calls = 0;
	let lastPath = "";
	const off = route(
		(path) => {
			calls++;
			lastPath = path;
		},
		{ match: "[data-route]" },
	);
	assert.strictEqual(calls, 1);

	dom.getElementById("slow-link").click();
	assert.strictEqual(calls, 1);

	dom.getElementById("fast-link").click();
	assert.strictEqual(calls, 2);
	assert.strictEqual(lastPath, "/instant");

	off();
});

test("Integration: route.go navigates programmatically", async (_t_context) => {
	setupDOM();

	assert.throws(() => route.go("/nowhere"), /no active router/);

	let currentPath = "";
	const off = route((path) => {
		currentPath = path;
	});
	route.go("/dashboard");
	assert.strictEqual(currentPath, "/dashboard");
	assert.strictEqual(globalThis.window.location.pathname, "/dashboard");

	off();
});

test("Integration: npm entry and battery subpaths share one core singleton", async (_t_context) => {
	// Self-reference resolution: "." must land in the same module graph the
	// batteries import, or The's statics fork (the #134 bug — "." pointed at
	// the dist bundle while ./live imported src).
	const entry = await import("on_the_money");
	const core = await import("../src/core/index.js");
	const TheDirect = (await import("../src/core/The.js")).default;
	assert.strictEqual(entry.the, core.the);
	assert.strictEqual(entry.the, TheDirect.the);
});

test("Integration: Namespace Storage", async (_t_context) => {
	setupDOM(`
		<div data-text="theme"></div>
	`);

	localStorage.clear();
	await the.boot({ persistKeys: ["theme"] });
	the("theme", "dark");

	assert.strictEqual(localStorage.getItem("otm:theme"), "dark");
	assert.strictEqual(localStorage.getItem("theme"), null);
});
