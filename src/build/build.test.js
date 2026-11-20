import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Builder from "./Builder.js";
import CssPruner from "./CssPruner.js";
import BuildCli from "./cli.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("CssPruner: collects tags from HTML body and inside <template> contents", () => {
	const tags = CssPruner.collectUsedTags([
		{
			file: "index.html",
			source: `<!DOCTYPE html><html><body>
				<main><button>Go</button></main>
				<template id="row"><article><h3>Title</h3><time>now</time></article></template>
			</body></html>`,
		},
	]);

	assert.ok(tags.has("main"));
	assert.ok(tags.has("button"));
	assert.ok(tags.has("article"));
	assert.ok(tags.has("h3"));
	assert.ok(tags.has("time"));
	assert.equal(tags.has("table"), false);
	assert.equal(tags.has("dialog"), false);
});

test("CssPruner: prunes unused tags while preserving @layer, @keyframes, ARIA, and :not() selectors", () => {
	const css = `
		@layer schema, scheme, structure, style, state;
		@layer schema {
			:root { --otm-color: #111; }
			p, table, blockquote { margin-block-end: 1rem; }
			table { inline-size: 100%; }
			dialog { padding: 1rem; }
			input:where(:not([type="checkbox"])) { inline-size: 100%; }
			[aria-invalid="true"] { border-color: red; }
			@keyframes otm-spin { to { rotate: 1turn; } }
		}
	`;
	const used = CssPruner.collectUsedTags([
		{
			file: "index.html",
			source:
				"<!DOCTYPE html><html><body><p>Hi</p><input type='text'></body></html>",
		},
	]);

	const pruned = CssPruner.prune(css, used);
	assert.match(pruned, /@layer schema, scheme, structure, style, state;/);
	assert.match(pruned, /:root\s*\{/);
	assert.match(pruned, /p\s*\{/);
	assert.doesNotMatch(pruned, /\btable\b/);
	assert.doesNotMatch(pruned, /\bblockquote\b/);
	assert.doesNotMatch(pruned, /\bdialog\b/);
	assert.match(pruned, /input:where/);
	assert.match(pruned, /\[aria-invalid="true"\]/);
	assert.match(pruned, /@keyframes otm-spin/);
});

test("Builder: bundles, prunes, minifies, hashes, and rewrites examples/todo", async () => {
	const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-todo-"));
	try {
		const result = await Builder.build({
			srcDir: path.join(root, "examples/todo"),
			outDir,
		});

		assert.equal(result.htmlCount, 1);
		assert.ok(result.cssBytesBefore > result.cssBytesAfter);
		assert.ok(result.jsBytes > 0);

		const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
		// Five <link rel="stylesheet"> collapsed to one hashed asset
		const links = html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/gi) || [];
		assert.equal(links.length, 1);
		const cssHref = links[0].match(/href="([^"]+)"/)?.[1];
		assert.match(cssHref, /^assets\/index\.[0-9a-f]{8}\.css$/);

		const css = await fs.readFile(path.join(outDir, cssHref), "utf8");
		// Todo uses <main>, <form>, <input>, <button>, <ul>, <li>, <header>, <footer>
		// It does NOT use <table>, <dialog>, <details>, <blockquote
		assert.doesNotMatch(css, /\btable\{/);
		assert.doesNotMatch(css, /\bdialog\{/);
		assert.match(css, /@layer schema,scheme,structure,style,state/);

		// Script bundled & hashed
		const scriptSrc = html.match(/<script\b[^>]*src="([^"]+)"/)?.[1];
		assert.match(scriptSrc, /^assets\/app\.[0-9a-f]{8}\.js$/);
		const js = await fs.readFile(path.join(outDir, scriptSrc), "utf8");
		assert.ok(js.length > 0);

		// Static companion locale copied
		const enLocale = JSON.parse(
			await fs.readFile(path.join(outDir, "locales/en.json"), "utf8"),
		);
		assert.equal(typeof enLocale.app_title, "string");
	} finally {
		await fs.rm(outDir, { recursive: true, force: true });
	}
});

test("Builder: respects prune: false and hash: false", async () => {
	const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-opts-"));
	try {
		const result = await Builder.build({
			srcDir: path.join(root, "examples/todo"),
			outDir,
			prune: false,
			hash: false,
		});

		assert.equal(result.cssBytesBefore, result.cssBytesAfter);
		const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
		assert.match(html, /href="assets\/index\.css"/);
		assert.match(html, /src="assets\/app\.js"/);
	} finally {
		await fs.rm(outDir, { recursive: true, force: true });
	}
});

test("BuildCli: runs end-to-end, prints help, and fails cleanly on invalid input", async () => {
	const helpCode = await BuildCli.run(["--help"]);
	assert.equal(helpCode, 0);

	const badArgs = await BuildCli.run(["a", "b"]);
	assert.equal(badArgs, 1);

	const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-empty-"));
	const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-cli-"));
	try {
		const noHtmlCode = await BuildCli.run([emptyDir, "--out", outDir]);
		assert.equal(noHtmlCode, 1);

		const okCode = await BuildCli.run([
			path.join(root, "examples/blog"),
			"--out",
			outDir,
		]);
		assert.equal(okCode, 0);
		const builtHtml = await fs.readFile(
			path.join(outDir, "index.html"),
			"utf8",
		);
		assert.match(builtHtml, /assets\/index\.[0-9a-f]{8}\.css/);
	} finally {
		await fs.rm(emptyDir, { recursive: true, force: true });
		await fs.rm(outDir, { recursive: true, force: true });
	}
});
