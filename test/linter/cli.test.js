import assert from "node:assert";
import test from "node:test";
import Cli from "../../src/linter/cli.js";

test("Cli.run: should return false when called with empty args", async (_t) => {
	const originalLog = console.log;
	console.log = () => {};
	const result = await Cli.run([]);
	console.log = originalLog;
	assert.strictEqual(result, false);
});

test("Cli.run: should return false when scan fails", async (_t) => {
	const originalError = console.error;
	const originalLog = console.log;
	console.error = () => {};
	console.log = () => {};
	const result = await Cli.run(["--check", "./non-existent-dir"]);
	console.error = originalError;
	console.log = originalLog;
	assert.strictEqual(result, false);
});

test("Cli.run: should return true and pass when scanning good fixtures", async (_t) => {
	const originalLog = console.log;
	console.log = () => {};
	const result = await Cli.run(["--check", "./fixtures/good"]);
	console.log = originalLog;
	assert.strictEqual(result, true);
});

test("Cli.run: should return true and report violations when scanning bad fixtures", async (_t) => {
	const originalLog = console.log;
	console.log = () => {};
	const result = await Cli.run(["--check", "./fixtures/bad"]);
	console.log = originalLog;
	assert.strictEqual(result, true);
});
