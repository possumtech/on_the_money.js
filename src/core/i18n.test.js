import assert from "node:assert";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import The from "./The.js";

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
	assert.strictEqual(
		The._t("price", { val: 9.99, type: "currency", currency: "USD" }),
		"$9.99",
	);
	assert.strictEqual(
		The._t("price", { val: 9.99, type: "currency", currency: "EUR" }),
		"€9.99",
	);
});

test("The._t: type=currency without an explicit currency throws", (_t) => {
	setupDOM();
	The.dictionary = {};
	assert.throws(
		() => The._t("price", { val: 9.99, type: "currency" }),
		/explicit currency/,
	);
	The.dictionary = { price: "Costs {val}" };
	assert.throws(
		() => The._t("price", { val: 9.99, type: "currency" }),
		/explicit currency/,
	);
});

test("The._t: invalid ISO 4217 codes throw via the platform", (_t) => {
	setupDOM();
	The.dictionary = {};
	assert.throws(
		() => The._t("price", { val: 1, type: "currency", currency: "NOPE!" }),
		RangeError,
	);
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

test("The._t: node hydration preserves textContent on missing keys", (_t) => {
	const { document } = setupDOM(
		'<h1 data-i18n="title">Welcome to the app</h1>',
	);
	The.dictionary = {};
	The._t(document.body);
	assert.strictEqual(
		document.querySelector("h1").textContent,
		"Welcome to the app",
	);
});

test("The._t: node hydration replaces textContent on present keys", (_t) => {
	const { document } = setupDOM(
		'<h1 data-i18n="title">Welcome to the app</h1>',
	);
	The.dictionary = { title: "Bienvenido" };
	The._t(document.body);
	assert.strictEqual(document.querySelector("h1").textContent, "Bienvenido");
});

test("The._t: node hydration Intl-formats currency without a dictionary entry", (_t) => {
	const { document } = setupDOM(
		'<span data-i18n="price" data-i18n-val="9.99" data-i18n-type="currency" data-i18n-currency="USD">$9.99</span>',
	);
	The.dictionary = {};
	The.locale = "en-US";
	The._t(document.body);
	assert.strictEqual(document.querySelector("span").textContent, "$9.99");
});

test("The._t: interpolation replaces every occurrence of a token", (_t) => {
	setupDOM();
	The.dictionary = { greet: "Hi {name} and {name}" };
	assert.strictEqual(The._t("greet", { name: "Alice" }), "Hi Alice and Alice");
});

test("The._t: interpolation is inert to replacement patterns in values", (_t) => {
	setupDOM();
	The.dictionary = { price: "Costs {val}" };
	assert.strictEqual(The._t("price", { val: "$& deal" }), "Costs $& deal");
});
