import assert from "node:assert";
import test from "node:test";
import Cli from "../src/linter/cli.js";

test("Cli.run: should return 0 when called with empty args", async (_t) => {
	const result = await Cli.run([]);
	assert.strictEqual(result, 0);
});

test("Cli.run: should return -1 when scan fails", async (_t) => {
	const result = await Cli.run(["--check", "./non-existent-dir"]);
	assert.strictEqual(result, -1);
});

test("Cli.run: should return 0 when scanning good fixtures", async (_t) => {
	const result = await Cli.run(["--check", "./fixtures/good"]);
	assert.strictEqual(result, 0);
});

test("Cli.run: should return violation count when scanning bad fixtures", async (_t) => {
	const result = await Cli.run(["--check", "./fixtures/bad"]);
	assert.ok(result > 0);
});
