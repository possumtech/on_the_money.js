import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import On from "../src/core/On.js";

const setupDOM = (html = "") => {
	const { document, CustomEvent, Node } = parseHTML(
		`<!DOCTYPE html><html><body>${html}</body></html>`,
	);
	globalThis.document = document;
	globalThis.CustomEvent = CustomEvent;
	globalThis.Node = Node;
	return document;
};

test("On.on: should delegate events to the selector", (_t) => {
	const dom = setupDOM('<button class="test">Click Me</button>');
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
	const dom = setupDOM('<button class="test"><span>Nested</span></button>');
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
	const dom = setupDOM(
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
	const dom = setupDOM('<div id="p"><button class="c">X</button></div>');
	let called = false;

	On.on("#p", "click", ".c", () => {
		called = true;
	});

	dom.querySelector(".c").click();
	assert.ok(called);
});

test("On.emit: should dispatch CustomEvent with detail", (_t) => {
	const dom = setupDOM('<div id="target"></div>');
	const el = dom.querySelector("#target");
	let received = null;

	el.addEventListener("my-event", (e) => {
		received = e.detail;
	});

	On.emit(el, "my-event", { foo: "bar" });
	assert.deepStrictEqual(received, { foo: "bar" });
});
