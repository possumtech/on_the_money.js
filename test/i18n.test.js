import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import The from "../src/core/The.js";

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
