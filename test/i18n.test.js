import assert from "node:assert";
import test from "node:test";
import The from "../src/core/The.js";

test("The._t: should exist as a static function", (_t) => {
	assert.strictEqual(typeof The._t, "function");
});

test("The._t: should return value from dictionary", (_t) => {
	The.dictionary = { hello: "world" };
	assert.strictEqual(The._t("hello"), "world");
});
