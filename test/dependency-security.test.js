import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import stylelint from "stylelint";
import plugin from "../src/stylelint/plugin.js";

const require = createRequire(import.meta.url);
const nested = (depth) => `${"{".repeat(depth)}a,b${"}".repeat(depth)}`;
const config = {
	plugins: [plugin],
	rules: {
		"otm/prefer-attribute-selector": true,
		"declaration-no-important": true,
	},
};

test("Stylelint 18's file-glob dependency graph does not contain affected braces", () => {
	assert.throws(() => require.resolve("braces"), {
		code: "MODULE_NOT_FOUND",
	});
	assert.throws(() => require.resolve("micromatch"), {
		code: "MODULE_NOT_FOUND",
	});
	assert.match(require.resolve("picomatch"), /node_modules\/picomatch\//);
	assert.match(require.resolve("tinyglobby"), /node_modules\/tinyglobby\//);
});

test("Stylelint's real file-glob path fails excessive nesting without stack exhaustion", async () => {
	await assert.rejects(
		stylelint.lint({ files: `**/${nested(4900)}`, config }),
		(error) => {
			assert.equal(error instanceof RangeError, false);
			assert.equal(error.name, "NoFilesFoundError");
			assert.match(error.message, /^No files matching the pattern/);
			return true;
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
