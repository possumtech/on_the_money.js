import assert from "node:assert";
import test from "node:test";
import Cli from "./cli.js";

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

test("Cli.scan: detects <meta name=i18n> regardless of attribute order", async (_t) => {
	const fs = await import("node:fs/promises");
	const os = await import("node:os");
	const path = await import("node:path");
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "otm-lint-meta-"));
	await fs.mkdir(path.join(tmp, "locales"));
	await fs.writeFile(path.join(tmp, "locales", "en.json"), '{"t":"T"}');
	await fs.writeFile(
		path.join(tmp, "index.html"),
		'<!DOCTYPE html><html lang="en"><head><meta content="./locales" data-available="en,zz" data-fallback="en" name="i18n"></head><body><h1 data-i18n="t">T</h1></body></html>',
	);
	// data-available lists "zz" the folder lacks → HTML-024 fires only if the
	// meta tag was actually detected despite content-before-name ordering.
	const result = await Cli.run(["--check", tmp]);
	assert.ok(result > 0, "expected HTML-024 from the mismatched manifest");
	await fs.rm(tmp, { recursive: true, force: true });
});

test("Cli.getFiles: collects .html, skips node_modules, dist, .git, dotdirs", async (_t) => {
	const fs = await import("node:fs/promises");
	const os = await import("node:os");
	const path = await import("node:path");
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "otm-lint-"));
	await fs.mkdir(path.join(tmp, "src"));
	await fs.mkdir(path.join(tmp, "node_modules"));
	await fs.mkdir(path.join(tmp, "dist"));
	await fs.mkdir(path.join(tmp, ".cache"));
	await fs.writeFile(path.join(tmp, "src", "ok.html"), "<p>hi</p>");
	await fs.writeFile(path.join(tmp, "src", "ignored.js"), "const x = 1;");
	await fs.writeFile(path.join(tmp, "node_modules", "leak.html"), "<p>x</p>");
	await fs.writeFile(path.join(tmp, "dist", "bundle.html"), "<p>x</p>");
	await fs.writeFile(path.join(tmp, ".cache", "junk.html"), "<p>x</p>");
	const found = await Cli.getFiles(tmp);
	assert.strictEqual(
		found.length,
		1,
		`expected only src/ok.html, got ${JSON.stringify(found)}`,
	);
	assert.ok(found[0].endsWith("ok.html"));
	await fs.rm(tmp, { recursive: true, force: true });
});

test("Cli.scan: .ejs joins the markup universe for cross-file rules", async (_t) => {
	const fs = await import("node:fs/promises");
	const os = await import("node:os");
	const path = await import("node:path");
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "otm-lint-ejs-"));
	await fs.writeFile(
		path.join(tmp, "partial.ejs"),
		'<small data-error-key="not-found" data-i18n="e"><%= msg %></small>',
	);
	await fs.writeFile(
		path.join(tmp, "state.css"),
		'body[data-error="not-found"] [data-error-key="not-found"] { display: block }',
	);
	// The span lives in EJS; the CSS ref must be satisfied by it (no false
	// dead-wiring) and the EJS template syntax must not trip per-file rules.
	const result = await Cli.run(["--check", tmp]);
	assert.strictEqual(result, 0);
	await fs.rm(tmp, { recursive: true, force: true });
});
