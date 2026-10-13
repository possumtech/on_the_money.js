import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Cli from "./cli.js";

const fixture = async (t, files) => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-i18n-"));
	t.after(() => fs.rm(dir, { recursive: true, force: true }));
	for (const [name, content] of Object.entries(files)) {
		const target = path.join(dir, name);
		await fs.mkdir(path.dirname(target), { recursive: true });
		await fs.writeFile(target, content);
	}
	return dir;
};

const localizedDocument = (endpoint) =>
	`<!doctype html><html lang="en"><head>${endpoint ? `<meta name="i18n" content="${endpoint}" data-available="es">` : ""}</head><body><h1 data-i18n="t">Hello</h1></body></html>`;

test("Cli: source-language HTML passes without dictionary files", async (t) => {
	quiet(t);
	const dir = await fixture(t, { "index.html": localizedDocument() });
	assert.strictEqual(await Cli.run(["--check", dir]), 0);
});

for (const [name, files] of [
	["missing directory", {}],
	["malformed JSON", { "locales/es.json": "{" }],
	["invalid dictionary shape", { "locales/es.json": "[]" }],
]) {
	test(`Cli: ${name} fails declared dictionary validation`, async (t) => {
		t.mock.method(console, "log", () => {});
		const errors = t.mock.method(console, "error", () => {});
		const dir = await fixture(t, {
			"index.html": localizedDocument("./locales"),
			...files,
		});
		assert.strictEqual(await Cli.run(["--check", dir]), -1);
		assert.match(errors.mock.calls[0].arguments[0], /dictionary|locales/);
	});
}

test("Cli: public-root maps root-relative dictionary URLs independently of HTML location", async (t) => {
	quiet(t);
	const dir = await fixture(t, {
		"pages/index.html": localizedDocument("/locales").replace(">Hello<", "><"),
		"public/locales/es.json": '{"wrong":"Hola"}',
	});
	const args = [
		"--check",
		path.join(dir, "pages"),
		"--public-root",
		path.join(dir, "public"),
	];
	assert.strictEqual(
		await Cli.run(args),
		1,
		"the actual served dictionary must be checked for missing t",
	);
	await fs.writeFile(path.join(dir, "public/locales/es.json"), '{"t":"Hola"}');
	assert.strictEqual(await Cli.run(args), 0);
});

test("Cli: unreadable dictionary reports the failing file and original error", async (t) => {
	t.mock.method(console, "log", () => {});
	const errors = t.mock.method(console, "error", () => {});
	const dir = await fixture(t, {
		"index.html": localizedDocument("./locales"),
		"locales/es.json": '{"t":"Hola"}',
	});
	const readFile = fs.readFile;
	t.mock.method(fs, "readFile", async (file, ...args) => {
		if (file === path.join(dir, "locales/es.json"))
			throw new Error("EACCES: permission denied");
		return readFile(file, ...args);
	});
	assert.strictEqual(await Cli.run(["--check", dir]), -1);
	assert.match(
		errors.mock.calls[0].arguments[0],
		/es\.json.*EACCES: permission denied/,
	);
});

// The CLI narrates to the console; in tests that chatter rides the test
// runner's worker IPC channel and has twice triggered the 'Unable to
// deserialize cloned data' race (#30). Silence it — exit codes are the
// contract under test, not the prose.
const quiet = (t) => {
	t.mock.method(console, "log", () => {});
	t.mock.method(console, "error", () => {});
};

test("Cli.run: should return 0 when called with empty args", async (t) => {
	quiet(t);
	const result = await Cli.run([]);
	assert.strictEqual(result, 0);
});

test("Cli.run: bare --check retains the current-directory default", async (t) => {
	quiet(t);
	const scan = t.mock.method(Cli, "scan", async () => 0);
	assert.strictEqual(await Cli.run(["--check"]), 0);
	assert.strictEqual(scan.mock.calls[0].arguments[0], ".");
});

test("Cli.run: should return -1 when scan fails", async (t) => {
	quiet(t);
	const result = await Cli.run(["--check", "./non-existent-dir"]);
	assert.strictEqual(result, -1);
});

test("Cli.run: should return 0 when scanning good fixtures", async (t) => {
	quiet(t);
	const result = await Cli.run(["--check", "./fixtures/good"]);
	assert.strictEqual(result, 0);
});

test("Cli.run: should return violation count when scanning bad fixtures", async (t) => {
	quiet(t);
	const result = await Cli.run(["--check", "./fixtures/bad"]);
	assert.ok(result > 0);
});

test("Cli.scan: detects <meta name=i18n> regardless of attribute order", async (t) => {
	quiet(t);
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

test("Cli.scan: .ejs joins the markup universe for cross-file rules", async (t) => {
	quiet(t);
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
