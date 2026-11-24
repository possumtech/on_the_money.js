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

test("layer-discipline: allows pure layout rules, static ARIA landmarks, and sublayers in structure.css", async () => {
	const { results } = await lint(
		`@layer structure {
			main { display: grid; gap: 1rem; max-inline-size: 48rem; }
			main:has(> footer) { grid-template-rows: 1fr auto; }
			nav[aria-label="Main navigation"] { grid-area: menu; }
			section[aria-labelledby="hero-title"] { display: flex; }
			input[role="combobox"][aria-autocomplete="list"] { inline-size: 100%; }
			[role="listbox"][aria-controls="items"] { position: relative; }
		}
		@layer structure.grid {
			section { display: flex; }
		}`,
		{
			codeFilename: "styles/structure.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	assert.strictEqual(results[0].warnings.length, 0);
});

test("layer-discipline: rejects unlayered and mismatched @layer blocks in 5-S files", async () => {
	const { results: unlayered } = await lint("main { display: grid; }", {
		codeFilename: "styles/structure.css",
		rules: { "otm/layer-discipline": true },
	});
	assert.strictEqual(unlayered[0].warnings.length, 1);
	assert.match(
		unlayered[0].warnings[0].text,
		/must be wrapped in "@layer structure \{ \.\.\. \}"/,
	);

	const { results: mismatched } = await lint(
		"@layer state { main { display: grid; } }",
		{
			codeFilename: "styles/structure.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	assert.strictEqual(mismatched[0].warnings.length, 1);
	assert.match(
		mismatched[0].warnings[0].text,
		/is in "@layer state" inside structure\.css/,
	);

	const { results: anon } = await lint("@layer { main { display: grid; } }", {
		codeFilename: "styles/structure.css",
		rules: { "otm/layer-discipline": true },
	});
	assert.strictEqual(anon[0].warnings.length, 1);
	assert.match(
		anon[0].warnings[0].text,
		/is in "@layer \(anonymous\)" inside structure\.css/,
	);
});

test("layer-discipline: rejects unlayered rules in layered non-5-S entry files and enforces inline @layer blocks", async () => {
	const { results: entry } = await lint(
		`@import "on_the_money/css";
		button { color: red; }`,
		{
			codeFilename: "styles/index.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	assert.strictEqual(entry[0].warnings.length, 1);
	assert.match(
		entry[0].warnings[0].text,
		/Unlayered rule "button" overrides @layer state/,
	);

	const { results: inlineLayers } = await lint(
		`@layer structure {
			main { color: red; }
		}
		@layer style {
			article { display: flex; }
		}
		@layer state {
			main { opacity: 0.5; }
		}`,
		{
			codeFilename: "styles/app.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	const texts = inlineLayers[0].warnings.map((w) => w.text);
	assert.strictEqual(texts.length, 3);
	assert.match(texts[0], /Stylistic property "color" belongs in style\.css/);
	assert.match(
		texts[1],
		/Structural layout property "display" belongs in structure\.css/,
	);
	assert.match(
		texts[2],
		/Unconditional selector "main" does not belong in state\.css/,
	);
});

test("layer-discipline: flags state selectors, interactive pseudos, and skin props/shorthands in structure.css", async () => {
	const { results } = await lint(
		`@layer structure {
			[data-open="true"] { display: block; color: red; background: white; }
			dialog[open] { border: 1px solid red; outline: 2px solid blue; }
			button:hover { padding: 1rem; }
			input:checked { margin: 0; }
		}`,
		{
			codeFilename: "styles/app-structure.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	const texts = results[0].warnings.map((w) => w.text);
	assert.strictEqual(texts.length, 8);
	assert.match(
		texts[0],
		/State selector "\[data-open\]" is forbidden in @layer structure/,
	);
	assert.match(texts[1], /Stylistic property "color" belongs in style\.css/);
	assert.match(
		texts[2],
		/Stylistic property "background" belongs in style\.css/,
	);
	assert.match(
		texts[3],
		/State selector "\[open\]" is forbidden in @layer structure/,
	);
	assert.match(texts[4], /Stylistic property "border" belongs in style\.css/);
	assert.match(texts[5], /Stylistic property "outline" belongs in style\.css/);
	assert.match(
		texts[6],
		/State selector ":hover" is forbidden in @layer structure/,
	);
	assert.match(
		texts[7],
		/State selector ":checked" is forbidden in @layer structure/,
	);
});

test("layer-discipline: allows skin, custom properties, static ARIA landmarks, and ephemeral hover/focus pseudos in style.css", async () => {
	const { results } = await lint(
		`@layer style {
			:root { --otm-border-radius: 0.5rem; }
			article { background: white; box-shadow: none; }
			nav[aria-label="breadcrumb"] button { background: transparent; }
			section[aria-describedby="lead"] { color: var(--otm-muted-color); }
			a {
				color: var(--otm-primary);
				&:hover,
				&:active,
				&:focus-visible {
					color: var(--otm-primary-hover);
				}
			}
			main:has(> footer) { background: canvas; }
		}`,
		{
			codeFilename: "styles/style.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	assert.strictEqual(results[0].warnings.length, 0);
});

test("layer-discipline: flags DOM state selectors and physical/logical layout props in style.css", async () => {
	const { results } = await lint(
		`@layer style {
			[aria-expanded="true"] { display: flex; gap: 0.5rem; }
			details[open] { inset-block-start: 0; inset-inline-end: 1rem; }
			[popover]:popover-open { align-self: center; justify-self: end; place-self: stretch; order: 2; }
			form:has([aria-invalid="true"]) { border-color: red; }
		}`,
		{
			codeFilename: "styles/app-style.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	const texts = results[0].warnings.map((w) => w.text);
	assert.strictEqual(texts.length, 12);
	assert.match(
		texts[0],
		/State selector "\[aria-expanded\]" is forbidden in @layer style/,
	);
	assert.match(
		texts[1],
		/Structural layout property "display" belongs in structure\.css/,
	);
	assert.match(
		texts[2],
		/Structural layout property "gap" belongs in structure\.css/,
	);
	assert.match(
		texts[3],
		/State selector "\[open\]" is forbidden in @layer style/,
	);
	assert.match(
		texts[4],
		/Structural layout property "inset-block-start" belongs in structure\.css/,
	);
	assert.match(
		texts[5],
		/Structural layout property "inset-inline-end" belongs in structure\.css/,
	);
	assert.match(
		texts[6],
		/State selector ":popover-open" is forbidden in @layer style/,
	);
	assert.match(
		texts[7],
		/Structural layout property "align-self" belongs in structure\.css/,
	);
	assert.match(
		texts[8],
		/Structural layout property "justify-self" belongs in structure\.css/,
	);
	assert.match(
		texts[9],
		/Structural layout property "place-self" belongs in structure\.css/,
	);
	assert.match(
		texts[10],
		/Structural layout property "order" belongs in structure\.css/,
	);
	assert.match(
		texts[11],
		/State selector "\[aria-invalid\]" is forbidden in @layer style/,
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
			nav[aria-label="Main"] a[aria-current="page"] { font-weight: 700; }
			form:has([aria-invalid="true"]) { border-color: red; }
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

test("layer-discipline: flags unconditional selectors including structural :has(), static ARIA landmarks, and mixed lists in state.css", async () => {
	const { results } = await lint(
		`@layer state {
			main { display: flex; }
			main:has(> footer) { display: grid; }
			nav[aria-label="Main"] { color: red; }
			article, [data-open="true"] { display: block; }
		}`,
		{
			codeFilename: "styles/app-state.css",
			rules: { "otm/layer-discipline": true },
		},
	);
	const texts = results[0].warnings.map((w) => w.text);
	assert.strictEqual(texts.length, 4);
	assert.match(
		texts[0],
		/Unconditional selector "main" does not belong in state\.css/,
	);
	assert.match(
		texts[1],
		/Unconditional selector "main:has\(> footer\)" does not belong in state\.css/,
	);
	assert.match(
		texts[2],
		/Unconditional selector "nav\[aria-label="Main"\]" does not belong in state\.css/,
	);
	assert.match(
		texts[3],
		/Unconditional selector "article, \[data-open="true"\]" does not belong in state\.css/,
	);
});

test("layer-discipline: ignores standalone non-layer filenames and disabled option", async () => {
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
