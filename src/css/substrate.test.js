import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import stylelint from "stylelint";
import config from "../stylelint/config.js";

const cssDir = fileURLToPath(new URL(".", import.meta.url));
const schemesDir = path.join(cssDir, "schemes");

const EXPECTED_SCHEMES = [
	"amber",
	"azure",
	"blue",
	"cyan",
	"fuchsia",
	"green",
	"grey",
	"indigo",
	"jade",
	"lime",
	"orange",
	"pink",
	"pumpkin",
	"purple",
	"red",
	"sand",
	"slate",
	"violet",
	"yellow",
	"zinc",
];

test("on_the_money/css ships schema, index, and all 20 Pico color schemes", async () => {
	const entries = (await fs.readdir(schemesDir))
		.filter((name) => name.endsWith(".css"))
		.map((name) => name.slice(0, -4))
		.sort();
	assert.deepEqual(entries, EXPECTED_SCHEMES);

	const indexCss = await fs.readFile(path.join(cssDir, "index.css"), "utf8");
	assert.match(indexCss, /@import\s+url\("\.\/schema\.css"\)/);
	assert.match(indexCss, /@import\s+url\("\.\/schemes\/azure\.css"\)/);

	const schemaCss = await fs.readFile(path.join(cssDir, "schema.css"), "utf8");
	assert.match(
		schemaCss,
		/@layer\s+schema,\s*scheme,\s*structure,\s*style,\s*state;/,
	);
	assert.match(schemaCss, /@layer\s+schema\s*\{/);
	assert.match(schemaCss, /\[aria-invalid="true"\]/);
	assert.match(schemaCss, /\[aria-busy="true"\]/);
	assert.match(schemaCss, /\[data-theme="dark"\]/);
});

test("every shipped CSS file passes OTM stylelint (zero classes, zero !important)", async () => {
	const files = [
		path.join(cssDir, "index.css"),
		path.join(cssDir, "schema.css"),
		...EXPECTED_SCHEMES.map((name) => path.join(schemesDir, `${name}.css`)),
	];
	const result = await stylelint.lint({
		files,
		config,
	});
	assert.equal(result.errored, false);
	for (const r of result.results) {
		assert.deepEqual(r.warnings, [], `Unexpected warnings in ${r.source}`);
	}
});
