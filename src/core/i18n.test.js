import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import The from "./The.js";

const setupDOM = (html = "") => {
	const dom = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
	globalThis.document = dom.document;
	globalThis.Node = dom.Node;
	return dom.document;
};

test("The._t: should exist as a static function", (_t) => {
	assert.strictEqual(typeof The._t, "function");
});

test("The._t: should return value from dictionary", (_t) => {
	setupDOM();
	The.dictionary = { hello: "world" };
	assert.strictEqual(The._t("hello"), "world");
});

test("The._t: missing entry with type=currency still Intl-formats val", (_t) => {
	setupDOM();
	The.dictionary = {};
	The.locale = "en-US";
	assert.strictEqual(The._t("price", { val: 9.99, type: "currency" }), "$9.99");
});

test("The._t: missing entry with type=date still Intl-formats val", (_t) => {
	setupDOM();
	The.dictionary = {};
	The.locale = "en-US";
	const out = The._t("when", { val: "2026-05-22", type: "date" });
	assert.match(out, /\d/);
	assert.notStrictEqual(out, "when");
});

test("The._t: missing entry with no type/val returns key", (_t) => {
	setupDOM();
	The.dictionary = {};
	assert.strictEqual(The._t("unknown"), "unknown");
});

test("The._t: missing entry with val but no type returns key", (_t) => {
	setupDOM();
	The.dictionary = {};
	assert.strictEqual(The._t("plain", { val: 42 }), "plain");
});
