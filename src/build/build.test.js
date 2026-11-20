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

test("CssPruner: prunes unused tags, handles :has() requirements and :is()/:where() disjunctions, and ignores :not()", () => {
	const css = `
		@layer schema, scheme, structure, style, state;
		@layer schema {
			:root { --otm-color: #111; }
			p, table, blockquote { margin-block-end: 1rem; }
			table { inline-size: 100%; }
			dialog { padding: 1rem; }
			p:has(> table) { color: red; }
			p:has(> span, > table) { color: green; }
			:where(ol, ul, menu) { margin: 0; }
			:is(dl, figure) { padding: 0; }
			input:where(:not([type="checkbox"])) { inline-size: 100%; }
			p:not(table) { line-height: 1.5; }
			[aria-invalid="true"] { border-color: red; }
			@keyframes otm-spin { to { rotate: 1turn; } }
		}
	`;
	const used = CssPruner.collectUsedTags([
		{
			file: "index.html",
			source:
				"<!DOCTYPE html><html><body><p><span>Hi</span></p><ul><li>One</li></ul><input type='text'></body></html>",
		},
	]);

	const pruned = CssPruner.prune(css, used);
	assert.match(pruned, /@layer schema, scheme, structure, style, state;/);
	assert.match(pruned, /:root\s*\{/);
	assert.match(pruned, /p\s*\{/);
	assert.doesNotMatch(pruned, /\btable\s*\{/);
	assert.doesNotMatch(pruned, /\bblockquote\b/);
	assert.doesNotMatch(pruned, /\bdialog\b/);
	// p:has(> table) requires <table>, so it MUST be pruned
	assert.doesNotMatch(pruned, /p:has\(>\s*table\)/);
	// p:has(> span, > table) matches because <span> exists
	assert.match(pruned, /p:has\(>\s*span,\s*>\s*table\)/);
	// :where(ol, ul, menu) matches because <ul> exists
	assert.match(pruned, /:where\(ol,\s*ul,\s*menu\)/);
	// :is(dl, figure) has neither <dl> nor <figure>, so it is pruned
	assert.doesNotMatch(pruned, /:is\(dl,\s*figure\)/);
	assert.match(pruned, /input:where/);
	assert.match(pruned, /p:not\(table\)/);
	assert.match(pruned, /\[aria-invalid="true"\]/);
	assert.match(pruned, /@keyframes otm-spin/);
});

test("Builder: defaults to lossless CSS (preserving rich-fragment tags) and bundles examples/todo", async () => {
	const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-todo-"));
	try {
		const result = await Builder.build({
			srcDir: path.join(root, "examples/todo"),
			outDir,
		});

		assert.equal(result.htmlCount, 1);
		assert.equal(result.cssBytesBefore, result.cssBytesAfter);
		assert.ok(result.jsBytes > 0);

		const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
		// Five <link rel="stylesheet"> collapsed to one hashed asset
		const links = html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/gi) || [];
		assert.equal(links.length, 1);
		const cssHref = links[0].match(/href="([^"]+)"/)?.[1];
		assert.match(cssHref, /^assets\/index\.[0-9a-f]{8}\.css$/);

		const css = await fs.readFile(path.join(outDir, cssHref), "utf8");
		// Default build is lossless: table/dialog/blockquote stay styled for rich fragments
		assert.match(css, /\btable\{/);
		assert.match(css, /\bdialog/);
		assert.match(css, /@layer schema,scheme,structure,style,state/);

		// Script bundled & hashed
		const scriptSrc = html.match(/<script\b[^>]*src="([^"]+)"/)?.[1];
		assert.match(scriptSrc, /^assets\/app\.[0-9A-Za-z]{8}\.js$/);
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

test("Builder: supports opt-in prune: true and hash: false", async () => {
	const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-opts-"));
	try {
		const result = await Builder.build({
			srcDir: path.join(root, "examples/todo"),
			outDir,
			prune: true,
			hash: false,
		});

		assert.ok(result.cssBytesBefore > result.cssBytesAfter);
		const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
		assert.match(html, /href="assets\/index\.css"/);
		assert.match(html, /src="assets\/app\.js"/);

		const css = await fs.readFile(
			path.join(outDir, "assets/index.css"),
			"utf8",
		);
		assert.doesNotMatch(css, /\btable\{/);
		assert.doesNotMatch(css, /\bdialog\{/);
	} finally {
		await fs.rm(outDir, { recursive: true, force: true });
	}
});

test("Builder: resolves root-relative refs, avoids MPA basename collisions, splits dynamic imports, and emits CSS url() assets", async () => {
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-mpa-"));
	const srcDir = path.join(tmp, "src");
	const outDir = path.join(tmp, "dist");
	try {
		await fs.mkdir(path.join(srcDir, "styles"), { recursive: true });
		await fs.mkdir(path.join(srcDir, "fonts"), { recursive: true });
		await fs.mkdir(path.join(srcDir, "about"), { recursive: true });
		await fs.mkdir(path.join(srcDir, "a"), { recursive: true });
		await fs.mkdir(path.join(srcDir, "b"), { recursive: true });

		await fs.writeFile(
			path.join(srcDir, "fonts/demo.woff2"),
			Buffer.from("wOF2demo-font-bytes"),
		);
		await fs.writeFile(
			path.join(srcDir, "styles/base.css"),
			`@font-face { font-family: "Demo"; src: url("../fonts/demo.woff2") format("woff2"); }
			body { font-family: "Demo", sans-serif; }\n`,
		);
		await fs.writeFile(
			path.join(srcDir, "styles/about.css"),
			"main { max-inline-size: 40rem; }\n",
		);
		await fs.writeFile(
			path.join(srcDir, "a/lazy.js"),
			'export const LAZY_MARKER = "OTM_LAZY_SPLIT_CHUNK";\n',
		);
		await fs.writeFile(
			path.join(srcDir, "a/page.js"),
			`export async function load() {
				const mod = await import("./lazy.js");
				return mod.LAZY_MARKER;
			}
			globalThis.pageA = load;\n`,
		);
		await fs.writeFile(
			path.join(srcDir, "b/page.js"),
			'globalThis.pageB = "SECOND_PAGE_BUNDLE";\n',
		);
		await fs.writeFile(
			path.join(srcDir, "index.html"),
			`<!DOCTYPE html><html><head>
				<link rel="stylesheet" href="/styles/base.css">
				<script type="module" src="/a/page.js"></script>
			</head><body><main><h1>Home</h1></main></body></html>`,
		);
		await fs.writeFile(
			path.join(srcDir, "about/index.html"),
			`<!DOCTYPE html><html><head>
				<link rel="stylesheet" href="/styles/base.css">
				<link rel="stylesheet" href="/styles/about.css">
				<script type="module" src="/b/page.js"></script>
			</head><body><main><h1>About</h1></main></body></html>`,
		);

		const result = await Builder.build({
			srcDir,
			outDir,
			hash: false,
		});

		assert.equal(result.htmlCount, 2);

		const homeHtml = await fs.readFile(path.join(outDir, "index.html"), "utf8");
		const aboutHtml = await fs.readFile(
			path.join(outDir, "about/index.html"),
			"utf8",
		);

		// Root-relative inputs preserve root-relative outputs and do NOT collide
		assert.match(homeHtml, /href="\/assets\/index\.css"/);
		assert.match(aboutHtml, /href="\/assets\/about\/index\.css"/);
		assert.match(homeHtml, /src="\/assets\/a\/page\.js"/);
		assert.match(aboutHtml, /src="\/assets\/b\/page\.js"/);

		const homeCss = await fs.readFile(
			path.join(outDir, "assets/index.css"),
			"utf8",
		);
		const aboutCss = await fs.readFile(
			path.join(outDir, "assets/about/index.css"),
			"utf8",
		);
		assert.doesNotMatch(homeCss, /max-inline-size:40rem/);
		assert.match(aboutCss, /max-inline-size:40rem/);

		// CSS url() font asset emitted and referenced with valid relative paths
		const emittedFont = await fs.readFile(
			path.join(outDir, "assets/media/demo.woff2"),
		);
		assert.equal(emittedFont.toString("utf8"), "wOF2demo-font-bytes");
		assert.match(
			homeCss,
			/url\(\.\/media\/demo\.woff2\)|url\("\.\/media\/demo\.woff2"\)/,
		);
		assert.match(
			aboutCss,
			/url\(\.\.\/media\/demo\.woff2\)|url\("\.\.\/media\/demo\.woff2"\)/,
		);

		// Distinct JS bundles emitted without clobbering, and lazy import stays split
		const pageA = await fs.readFile(
			path.join(outDir, "assets/a/page.js"),
			"utf8",
		);
		const pageB = await fs.readFile(
			path.join(outDir, "assets/b/page.js"),
			"utf8",
		);
		assert.doesNotMatch(pageA, /OTM_LAZY_SPLIT_CHUNK/);
		assert.match(pageA, /import\(["']\.\.\/chunks\/lazy\.js["']\)/);
		assert.match(pageB, /SECOND_PAGE_BUNDLE/);

		const lazyChunk = await fs.readFile(
			path.join(outDir, "assets/chunks/lazy.js"),
			"utf8",
		);
		assert.match(lazyChunk, /OTM_LAZY_SPLIT_CHUNK/);
	} finally {
		await fs.rm(tmp, { recursive: true, force: true });
	}
});

test("BuildCli: runs end-to-end, supports --prune, prints help, and fails cleanly on invalid input", async () => {
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
			"--prune",
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
