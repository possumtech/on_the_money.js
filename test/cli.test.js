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

test("Cli.getFiles: skips node_modules, dist, .git, and dotdirs", async (_t) => {
	const fs = await import("node:fs/promises");
	const os = await import("node:os");
	const path = await import("node:path");
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "otm-lint-"));
	await fs.mkdir(path.join(tmp, "src"));
	await fs.mkdir(path.join(tmp, "node_modules"));
	await fs.mkdir(path.join(tmp, "dist"));
	await fs.mkdir(path.join(tmp, ".cache"));
	await fs.writeFile(path.join(tmp, "src", "ok.js"), "const x = 1;");
	await fs.writeFile(path.join(tmp, "node_modules", "leak.js"), "el.innerHTML = 'x';");
	await fs.writeFile(path.join(tmp, "dist", "bundle.js"), "el.innerHTML = 'x';");
	await fs.writeFile(path.join(tmp, ".cache", "junk.js"), "el.innerHTML = 'x';");
	const found = await Cli.getFiles(tmp);
	assert.strictEqual(found.length, 1, `expected only src/ok.js, got ${JSON.stringify(found)}`);
	assert.ok(found[0].endsWith("ok.js"));
	await fs.rm(tmp, { recursive: true, force: true });
});
