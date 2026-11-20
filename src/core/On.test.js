import assert from "node:assert";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import On from "./On.js";

test("On.on: rejects missing or invalid selector/handler at registration", () => {
	const { document } = setupDOM('<form id="form"></form>');
	for (const args of [
		["#form", "submit", () => {}],
		["#form", "submit", "", () => {}],
		["#form", "submit", "form", null],
	]) {
		assert.throws(() => On.on(...args), {
			name: "TypeError",
			message: "on(): expected (parent, event, selector, handler)",
		});
	}
	let submitted = false;
	On.on("#form", "submit", "form", (event) => {
		event.preventDefault();
		submitted = true;
	});
	document
		.querySelector("form")
		.dispatchEvent(new CustomEvent("submit", { bubbles: true }));
	assert.equal(submitted, true);
});

test("On.on: should delegate events to the selector", (_t) => {
	const { document: dom } = setupDOM('<button class="test">Click Me</button>');
	const btn = dom.querySelector(".test");
	let called = false;

	On.on(dom.body, "click", ".test", (_e, target) => {
		called = true;
		assert.strictEqual(target, btn);
	});

	btn.click();
	assert.ok(called);
});

test("On.on: should handle nested clicks correctly", (_t) => {
	const { document: dom } = setupDOM(
		'<button class="test"><span>Nested</span></button>',
	);
	const btn = dom.querySelector(".test");
	const span = dom.querySelector("span");
	let called = false;

	On.on(dom.body, "click", ".test", (_e, target) => {
		called = true;
		assert.strictEqual(target, btn);
	});

	span.click();
	assert.ok(called);
});

test("On.on: should ignore clicks outside selector", (_t) => {
	const { document: dom } = setupDOM(
		'<button class="test">Match</button><div class="miss">Miss</div>',
	);
	const miss = dom.querySelector(".miss");
	let called = false;

	On.on(dom.body, "click", ".test", () => {
		called = true;
	});

	miss.click();
	assert.strictEqual(called, false);
});

test("On.on: should find parent if selector is string", (_t) => {
	const { document: dom } = setupDOM(
		'<div id="p"><button class="c">X</button></div>',
	);
	let called = false;

	On.on("#p", "click", ".c", () => {
		called = true;
	});

	dom.querySelector(".c").click();
	assert.ok(called);
});

test("On.on: returns an unsubscribe function", (_t) => {
	const { document: dom } = setupDOM('<button class="x">go</button>');
	const btn = dom.querySelector(".x");
	let count = 0;
	const off = On.on(dom.body, "click", ".x", () => count++);
	btn.click();
	assert.strictEqual(count, 1);
	off();
	btn.click();
	assert.strictEqual(count, 1);
});

test("On.on: throws a named error when the parent selector matches nothing", (_t) => {
	setupDOM();
	assert.throws(
		() => On.on("#missing", "click", ".c", () => {}),
		/parent selector matched nothing: #missing/,
	);
});

test("On.emit: should dispatch CustomEvent with detail", (_t) => {
	const { document: dom } = setupDOM('<div id="target"></div>');
	const el = dom.querySelector("#target");
	let received = null;

	el.addEventListener("my-event", (e) => {
		received = e.detail;
	});

	On.emit(el, "my-event", { foo: "bar" });
	assert.deepStrictEqual(received, { foo: "bar" });
});

test("On.target: subscribes multiple handlers on non-Element EventTargets and detaches via off() or AbortSignal", () => {
	const { document: dom, window } = setupDOM('<button id="btn">x</button>');
	assert.throws(
		() => On.target(dom.getElementById("btn"), "click", () => {}),
		/expected a non-Element EventTarget/,
	);
	assert.throws(
		() => On.target(null, "resize", () => {}),
		/expected a non-Element EventTarget/,
	);
	for (const bad of [
		[window, "", () => {}],
		[window, "resize", null],
		[window, "resize", () => {}, null],
	]) {
		assert.throws(() => On.target(...bad), {
			name: "TypeError",
			message: "on.target(): expected (target, event, handler, options?)",
		});
	}

	const calls = [];
	const ac = new AbortController();
	const offA = On.target(window, "resize", () => calls.push("a"));
	On.target(window, "resize", () => calls.push("b"), { signal: ac.signal });
	On.target(dom, "visibilitychange", () => calls.push("vis"), {
		once: true,
		signal: ac.signal,
	});

	window.dispatchEvent(new CustomEvent("resize"));
	dom.dispatchEvent(new CustomEvent("visibilitychange"));
	dom.dispatchEvent(new CustomEvent("visibilitychange"));
	assert.deepStrictEqual(calls, ["a", "b", "vis"]);

	ac.abort();
	window.dispatchEvent(new CustomEvent("resize"));
	assert.deepStrictEqual(calls, ["a", "b", "vis", "a"]);

	offA();
	window.dispatchEvent(new CustomEvent("resize"));
	assert.deepStrictEqual(calls, ["a", "b", "vis", "a"]);

	const preAborted = new AbortController();
	preAborted.abort();
	const noopOff = On.target(window, "resize", () => calls.push("never"), {
		signal: preAborted.signal,
	});
	window.dispatchEvent(new CustomEvent("resize"));
	noopOff();
	assert.deepStrictEqual(calls, ["a", "b", "vis", "a"]);
});

test("On.on: pools one native DOM listener per (parent, event) pair and detaches on last unsubscribe", (t) => {
	const { document: dom } = setupDOM(
		'<button data-action="a">A</button><button data-action="b">B</button>',
	);
	const addSpy = t.mock.method(dom.body, "addEventListener");
	const removeSpy = t.mock.method(dom.body, "removeEventListener");

	const calls = [];
	const offA = On.on(dom.body, "click", '[data-action="a"]', () =>
		calls.push("a"),
	);
	const offB = On.on(dom.body, "click", '[data-action="b"]', () =>
		calls.push("b"),
	);

	assert.strictEqual(addSpy.mock.callCount(), 1);
	assert.strictEqual(removeSpy.mock.callCount(), 0);

	dom.querySelector('[data-action="a"]').click();
	dom.querySelector('[data-action="b"]').click();
	assert.deepStrictEqual(calls, ["a", "b"]);

	offA();
	assert.strictEqual(removeSpy.mock.callCount(), 0);
	dom.querySelector('[data-action="a"]').click();
	dom.querySelector('[data-action="b"]').click();
	assert.deepStrictEqual(calls, ["a", "b", "b"]);

	offB();
	offB(); // idempotent double unsubscribe
	assert.strictEqual(removeSpy.mock.callCount(), 1);
});

test("On.on: handles non-Element event targets (e.g. Text nodes) without throwing", () => {
	const { document: dom } = setupDOM('<button data-action="go">Hi</button>');
	const btn = dom.querySelector("button");
	let matched = null;
	let capturedDispatch = null;
	const origAdd = dom.body.addEventListener.bind(dom.body);
	dom.body.addEventListener = (type, fn, opts) => {
		if (type === "custom-hit") capturedDispatch = fn;
		return origAdd(type, fn, opts);
	};

	On.on(dom.body, "custom-hit", '[data-action="go"]', (_e, target) => {
		matched = target;
	});

	// Text node child has parentElement (btn) but no .closest() method
	const textNode = btn.firstChild;
	assert.strictEqual(typeof textNode.closest, "undefined");
	capturedDispatch({ target: textNode });
	assert.strictEqual(matched, btn);

	// Target with neither .closest nor .parentElement is safely ignored
	assert.doesNotThrow(() => capturedDispatch({ target: dom }));
});
