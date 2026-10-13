import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import stylelint from "stylelint";
import plugin from "../src/stylelint/plugin.js";

const require = createRequire(import.meta.url);
const fromStylelint = createRequire(require.resolve("stylelint"));
const fromFastGlob = createRequire(fromStylelint.resolve("fast-glob"));
const fromMicromatch = createRequire(fromFastGlob.resolve("micromatch"));
const braces = fromMicromatch("braces");
const nested = (depth) => `${"{".repeat(depth)}a,b${"}".repeat(depth)}`;
const config = {
	plugins: [plugin],
	rules: {
		"otm/prefer-attribute-selector": true,
		"declaration-no-important": true,
	},
};

test("Stylelint's installed braces rejects excessive nesting before stack exhaustion", () => {
	for (const method of ["parse", "compile", "expand", "stringify"]) {
		for (const depth of [101, 4900]) {
			assert.throws(() => braces[method](nested(depth)), {
				name: "SyntaxError",
				message: "Input depth (101), exceeds max depth (100)",
			});
		}
	}
});

test("bounded brace parsing preserves ordinary alternatives, ranges, and nesting", () => {
	assert.deepEqual(braces.expand("src/{core,live}/*.{js,ts}"), [
		"src/core/*.js",
		"src/core/*.ts",
		"src/live/*.js",
		"src/live/*.ts",
	]);
	assert.deepEqual(braces.expand("{01..03}"), ["01", "02", "03"]);
	assert.deepEqual(braces.expand("a/{b,{c,d}}"), ["a/b", "a/c", "a/d"]);
	assert.equal(braces.compile("src/{core,live}/*.js"), "src/(core|live)/*.js");
	assert.equal(braces.stringify(braces.parse(nested(100))), nested(100));
});

test("Stylelint's real file-glob path rejects excessive nesting with the bounded error", async () => {
	await assert.rejects(
		stylelint.lint({ files: `**/${nested(4900)}`, config }),
		{
			name: "SyntaxError",
			message: "Input depth (101), exceeds max depth (100)",
		},
	);
});

test("Stylelint still lints real example files through brace expansion", async () => {
	const result = await stylelint.lint({
		files: "examples/{blog,todo}/*.css",
		config,
	});
	assert.equal(result.errored, false);
	assert.equal(result.results.length, 2);
	assert.deepEqual(
		result.results.flatMap(({ warnings }) => warnings),
		[],
	);
});

test("CSS content does not become a file glob", async () => {
	const result = await stylelint.lint({
		code: `main::before { content: ${JSON.stringify(nested(4900))}; }`,
		config,
	});
	assert.equal(result.errored, false);
	assert.deepEqual(result.results[0].warnings, []);
});
