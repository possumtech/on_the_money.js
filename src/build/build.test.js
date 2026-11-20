import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import LintCli from "../linter/cli.js";
import Builder from "./Builder.js";
import BuildCli from "./cli.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("Builder: bundles examples/todo losslessly (preserving semantic tags), minifies, hashes, and copies companions", async () => {
	const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-todo-"));
	try {
		const result = await Builder.build({
			srcDir: path.join(root, "examples/todo"),
			outDir,
		});

		assert.equal(result.htmlCount, 1);
		assert.ok(result.cssBytes > 0);
		assert.ok(result.jsBytes > 0);

		const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
		// Five <link rel="stylesheet"> collapsed to one hashed asset
		const links = html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/gi) || [];
		assert.equal(links.length, 1);
		const cssHref = links[0].match(/href="([^"]+)"/)?.[1];
		assert.match(cssHref, /^assets\/index\.[0-9a-f]{8}\.css$/);

		const css = await fs.readFile(path.join(outDir, cssHref), "utf8");
		// Lossless build preserves semantic schema rules for rich fragments & SSR pages
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

test("Builder: respects hash: false", async () => {
	const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-opts-"));
	try {
		const result = await Builder.build({
			srcDir: path.join(root, "examples/todo"),
			outDir,
			hash: false,
		});

		assert.ok(result.cssBytes > 0);
		const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
		assert.match(html, /href="assets\/index\.css"/);
		assert.match(html, /src="assets\/app\.js"/);
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

test("Builder: composes cleanly with upstream Markdown/content filters (preserves alternate links, .md companions, llms.txt, and passes otm-lint)", async (t) => {
	t.mock.method(console, "log", () => {});
	t.mock.method(console, "error", () => {});
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "otm-build-agentic-"));
	const srcDir = path.join(tmp, "stage");
	const outDir = path.join(tmp, "dist");
	try {
		await fs.mkdir(path.join(srcDir, "posts"), { recursive: true });
		await fs.writeFile(
			path.join(srcDir, "llms.txt"),
			"# Example Docs\n\n> Canonical Markdown docs rendered to semantic HTML.\n\n## Posts\n\n- [Hello World](/posts/hello.md): First post\n",
		);
		await fs.writeFile(
			path.join(srcDir, "posts/hello.md"),
			"# Hello World\n\n> Quoted prose.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n",
		);
		await fs.writeFile(
			path.join(srcDir, "styles.css"),
			`@import "${path.join(root, "src/css/index.css").split(path.sep).join("/")}";\n`,
		);
		await fs.writeFile(
			path.join(srcDir, "posts/hello.html"),
			`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hello World</title>
  <link rel="alternate" type="text/markdown" href="./hello.md">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <header><nav aria-label="Primary"><a href="/">Home</a></nav></header>
  <main>
    <article>
      <h1>Hello World</h1>
      <blockquote><p>Quoted prose.</p></blockquote>
      <table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
    </article>
  </main>
  <footer><nav aria-label="Footer"><a href="/llms.txt">llms.txt</a></nav></footer>
</body>
</html>`,
		);

		const result = await Builder.build({ srcDir, outDir });
		assert.equal(result.htmlCount, 1);

		const builtHtml = await fs.readFile(
			path.join(outDir, "posts/hello.html"),
			"utf8",
		);
		assert.match(
			builtHtml,
			/<link\b[^>]*rel="alternate"[^>]*type="text\/markdown"[^>]*href="\.\/hello\.md"/,
		);
		assert.match(
			builtHtml,
			/href="\.\.\/assets\/posts\/hello\.[0-9a-f]{8}\.css"/,
		);

		const builtMd = await fs.readFile(
			path.join(outDir, "posts/hello.md"),
			"utf8",
		);
		assert.match(builtMd, /# Hello World/);
		const builtLlms = await fs.readFile(path.join(outDir, "llms.txt"), "utf8");
		assert.match(builtLlms, /\/posts\/hello\.md/);

		const lintViolations = await LintCli.run([
			"--check",
			outDir,
			"--public-root",
			outDir,
		]);
		assert.equal(lintViolations, 0);
	} finally {
		await fs.rm(tmp, { recursive: true, force: true });
	}
});
