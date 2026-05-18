import assert from "node:assert";
import test from "node:test";
import stylelint from "stylelint";
import plugin from "./plugin.js";

const lint = async (code) =>
	stylelint.lint({
		code,
		config: {
			plugins: [plugin],
			rules: { "otm/prefer-attribute-selector": true },
		},
	});

test("prefer-attribute-selector: flags class selectors", async () => {
	const { results } = await lint(".active { color: red; }");
	const warnings = results[0].warnings;
	assert.strictEqual(warnings.length, 1);
	assert.match(warnings[0].text, /Class selector "\.active" is forbidden/);
});

test("prefer-attribute-selector: allows attribute selectors", async () => {
	const { results } = await lint('[data-state="active"] { color: red; }');
	assert.strictEqual(results[0].warnings.length, 0);
});

test("prefer-attribute-selector: allows element selectors", async () => {
	const { results } = await lint("main > section { display: none; }");
	assert.strictEqual(results[0].warnings.length, 0);
});

test("prefer-attribute-selector: allows pseudo-classes", async () => {
	const { results } = await lint("button:hover { opacity: 0.8; }");
	assert.strictEqual(results[0].warnings.length, 0);
});

test("prefer-attribute-selector: flags nested classes in compound selector", async () => {
	const { results } = await lint("nav .item .active { color: red; }");
	const warnings = results[0].warnings;
	assert.strictEqual(warnings.length, 2);
});

test("prefer-attribute-selector: doesn't flag class inside attribute value", async () => {
	const { results } = await lint('[class="x"] { color: red; }');
	assert.strictEqual(results[0].warnings.length, 0);
});

test("prefer-attribute-selector: respects rule disabled", async () => {
	const { results } = await stylelint.lint({
		code: ".active { color: red; }",
		config: {
			plugins: [plugin],
			rules: { "otm/prefer-attribute-selector": false },
		},
	});
	assert.strictEqual(results[0].warnings.length, 0);
});
