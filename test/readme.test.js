import assert from "node:assert";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import Linter from "../src/linter/Linter.js";
import { setupDOM } from "../src/test/index.js";

const run = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));

const md = await fs.readFile(path.join(root, "README.md"), "utf-8");
const blocks = [...md.matchAll(/```(\w+)\n([\s\S]*?)```/g)].map(
	([, lang, code], i) => ({ lang, code, i }),
);

const htmlBlocks = blocks.filter((b) => b.lang === "html");
const jsBlocks = blocks.filter((b) => b.lang === "javascript");
const cssBlocks = blocks.filter((b) => b.lang === "css");

test("README: contains html, javascript, and css blocks", (_t) => {
	assert.ok(htmlBlocks.length > 0);
	assert.ok(jsBlocks.length > 0);
	assert.ok(cssBlocks.length > 0);
});

test("README: every HTML block passes otm-lint per-file rules", (_t) => {
	for (const { code, i } of htmlBlocks) {
		const violations = Linter.check(`readme-block-${i}.html`, code).filter(
			(v) => v.severity !== "warn",
		);
		assert.deepStrictEqual(
			violations,
			[],
			`HTML block #${i} violates the lint stack:\n${JSON.stringify(violations, null, 2)}\n---\n${code}`,
		);
	}
});

test("README: quickstart passes the full cross-file scan", (_t) => {
	const html = htmlBlocks[0].code;
	const js = jsBlocks[0].code;
	const perFile = Linter.check("index.html", html);
	const cross = Linter.crossCheck({
		htmlSources: [{ file: "index.html", source: html, dicts: [] }],
		jsSources: [{ file: "app.js", source: js }],
		cssSources: [],
	});
	const errors = [...perFile, ...cross].filter((v) => v.severity !== "warn");
	assert.deepStrictEqual(
		errors,
		[],
		`Quickstart is not lint-clean:\n${JSON.stringify(errors, null, 2)}`,
	);
});

test("README: every JavaScript block parses as a module", async (_t) => {
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "otm-readme-"));
	try {
		for (const { code, i } of jsBlocks) {
			const file = path.join(tmp, `block-${i}.mjs`);
			await fs.writeFile(file, code);
			await assert.doesNotReject(
				run(process.execPath, ["--check", file]),
				`JavaScript block #${i} does not parse:\n---\n${code}`,
			);
		}
	} finally {
		await fs.rm(tmp, { recursive: true, force: true });
	}
});

test("README: every CSS block passes the shipped stylelint config", async (_t) => {
	const { default: stylelint } = await import("stylelint");
	const { default: config } = await import(
		pathToFileURL(path.join(root, "src/stylelint/config.js"))
	);
	// Resolve the plugin directly — self-reference string resolution is
	// exercised by npm run lint:examples; here we test the rule itself.
	const resolved = {
		...config,
		plugins: [path.join(root, "src/stylelint/plugin.js")],
	};
	for (const { code, i } of cssBlocks) {
		const result = await stylelint.lint({ code, config: resolved });
		const warnings = result.results.flatMap((r) => r.warnings);
		assert.deepStrictEqual(
			warnings,
			[],
			`CSS block #${i} violates the stylelint config:\n${JSON.stringify(warnings, null, 2)}\n---\n${code}`,
		);
	}
});

test("README: quickstart executes end-to-end", async (_t) => {
	const html = htmlBlocks[0].code;
	const js = jsBlocks[0].code;

	const lang = html.match(/<html lang="([^"]+)"/)?.[1];
	const bodyInner = html.match(/<body>([\s\S]*?)<\/body>/)[1];

	const { document } = setupDOM(bodyInner);
	if (lang) document.documentElement.setAttribute("lang", lang);

	let fetched = false;
	globalThis.fetch = async () => {
		fetched = true;
		return { ok: false, status: 404 };
	};

	const coreIndex = pathToFileURL(path.join(root, "src/core/index.js")).href;
	const rewritten = js.replaceAll('from "on_the_money"', `from "${coreIndex}"`);
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "otm-quickstart-"));
	try {
		const file = path.join(tmp, "app.mjs");
		await fs.writeFile(file, rewritten);
		await import(pathToFileURL(file).href);

		// <html lang="en"> + en visitor → boot short-circuits: no fetch.
		assert.strictEqual(fetched, false);

		document.querySelector('[data-action="greet"]').click();
		assert.strictEqual(
			document.querySelector('[data-text="greeting"]').textContent,
			"Hello, Alice!",
		);
	} finally {
		await fs.rm(tmp, { recursive: true, force: true });
	}
});
