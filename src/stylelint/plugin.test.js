import assert from "node:assert";
import test from "node:test";
import stylelint from "stylelint";
import plugin from "./plugin.js";

const lint = async (
	code,
	{ rules = { "otm/prefer-attribute-selector": true }, codeFilename } = {},
) =>
	stylelint.lint({
		code,
		codeFilename,
		config: {
			plugins: [plugin],
			rules,
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
	const { results } = await lint(".active { color: red; }", {
		rules: { "otm/prefer-attribute-selector": false },
	});
	assert.strictEqual(results[0].warnings.length, 0);
});

test("layer-discipline: allows pure layout rules in structure.css", async () => {
	const { results } = await lint(
		"@layer structure { main { display: grid; gap: 1rem; max-width: 48rem; } }",
		{
			codeFilename: "styles/structure.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	assert.strictEqual(results[0].warnings.length, 0);
});

test("layer-discipline: flags state selectors and skin props in structure.css", async () => {
	const { results } = await lint(
		'[data-open="true"] { display: block; color: red; background: white; }',
		{
			codeFilename: "styles/app-structure.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	const texts = results[0].warnings.map((w) => w.text);
	assert.strictEqual(texts.length, 3);
	assert.match(
		texts[0],
		/State selector "\[data-open\]" is forbidden in structure\.css/,
	);
	assert.match(texts[1], /Stylistic property "color" belongs in style\.css/);
	assert.match(
		texts[2],
		/Stylistic property "background" belongs in style\.css/,
	);
});

test("layer-discipline: allows skin and custom-property rules in style.css", async () => {
	const { results } = await lint(
		"@layer style { :root { --otm-border-radius: 0.5rem; } article { background: white; box-shadow: none; } }",
		{
			codeFilename: "styles/style.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	assert.strictEqual(results[0].warnings.length, 0);
});

test("layer-discipline: flags layout props and state selectors in style.css", async () => {
	const { results } = await lint(
		'[aria-expanded="true"] { display: flex; gap: 0.5rem; }',
		{
			codeFilename: "styles/app-style.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	const texts = results[0].warnings.map((w) => w.text);
	assert.strictEqual(texts.length, 3);
	assert.match(
		texts[0],
		/State selector "\[aria-expanded\]" is forbidden in style\.css/,
	);
	assert.match(
		texts[1],
		/Structural layout property "display" belongs in structure\.css/,
	);
	assert.match(
		texts[2],
		/Structural layout property "gap" belongs in structure\.css/,
	);
});

test("layer-discipline: allows state-driven rules and nested children in state.css", async () => {
	const { results } = await lint(
		`@layer state {
			body[data-page="home"] main > section[data-route="home"] { display: block; }
			[data-item] button[data-action="delete"] {
				color: red;
				&::before { content: "x"; }
			}
			dialog[open] { display: block; }
			button:focus-visible { outline: 2px solid; }
			@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
		}`,
		{
			codeFilename: "styles/state.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	assert.strictEqual(results[0].warnings.length, 0);
});

test("layer-discipline: flags unconditional rules in state.css", async () => {
	const { results } = await lint("main { display: flex; }", {
		codeFilename: "styles/app-state.css",
		rules: { "otm/layer-discipline": true },
	});
	assert.strictEqual(results[0].warnings.length, 1);
	assert.match(
		results[0].warnings[0].text,
		/Unconditional selector "main" does not belong in state\.css/,
	);
});

test("layer-discipline: ignores non-layer filenames and disabled option", async () => {
	const { results: other } = await lint("main { display: flex; color: red; }", {
		codeFilename: "styles/custom.css",
		rules: { "otm/layer-discipline": true },
	});
	assert.strictEqual(other[0].warnings.length, 0);

	const { results: disabled } = await lint("main { display: flex; }", {
		codeFilename: "styles/style.css",
		rules: { "otm/layer-discipline": false },
	});
	assert.strictEqual(disabled[0].warnings.length, 0);
});
