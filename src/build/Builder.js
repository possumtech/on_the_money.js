import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { build as esbuild, transform as esbuildTransform } from "esbuild";
import { serialize } from "parse5";
import Markup from "../linter/Markup.js";
import CssPruner from "./CssPruner.js";

const EXCLUDE_DIRS = new Set(["node_modules", "dist", ".git"]);
const EXTERNAL_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

const shortHash = (buf) =>
	crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);

const isLocalRef = (href) => Boolean(href && !EXTERNAL_URL_RE.test(href));

const getAttr = (node, name) =>
	(node.attrs || []).find((a) => a.name.toLowerCase() === name)?.value ?? null;

const setAttr = (node, name, value) => {
	const existing = (node.attrs || []).find(
		(a) => a.name.toLowerCase() === name,
	);
	if (existing) existing.value = value;
	else {
		node.attrs = node.attrs || [];
		node.attrs.push({ name, value });
	}
};

export default class Builder {
	static async build({
		srcDir = ".",
		outDir = "dist",
		prune = true,
		hash = true,
	} = {}) {
		const absSrc = path.resolve(srcDir);
		const absOut = path.resolve(outDir);

		const allFiles = await Builder.#walk(absSrc, absOut);
		const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));

		if (htmlFiles.length === 0) {
			throw new Error(`No .html entry files found in ${absSrc}`);
		}

		const htmlSources = await Promise.all(
			htmlFiles.map(async (file) => ({
				file,
				source: await fs.readFile(file, "utf8"),
			})),
		);

		const usedTags = CssPruner.collectUsedTags(htmlSources);

		await fs.mkdir(absOut, { recursive: true });
		const assetsDir = path.join(absOut, "assets");
		await fs.mkdir(assetsDir, { recursive: true });

		const emitted = new Map();
		let cssBytesBefore = 0;
		let cssBytesAfter = 0;
		let jsBytes = 0;

		for (const { file, source } of htmlSources) {
			const relHtml = path.relative(absSrc, file);
			const htmlDir = path.dirname(file);
			const outHtmlPath = path.join(absOut, relHtml);
			const outHtmlDir = path.dirname(outHtmlPath);
			await fs.mkdir(outHtmlDir, { recursive: true });

			const doc = Markup.parse(file, source);

			// 1. Collect local stylesheet <link> elements in document order
			const cssLinks = [];
			const scriptNodes = [];
			const walk = (node) => {
				if (node.nodeName === "link") {
					const rel = (getAttr(node, "rel") || "").toLowerCase();
					const href = getAttr(node, "href");
					if (rel === "stylesheet" && isLocalRef(href)) {
						cssLinks.push({ node, href });
					}
				} else if (node.nodeName === "script") {
					const src = getAttr(node, "src");
					if (isLocalRef(src)) {
						scriptNodes.push({ node, src });
					}
				}
				for (const child of node.childNodes || []) walk(child);
			};
			walk(doc);

			// 2. Collapse, bundle, prune, and minify local CSS into one stylesheet
			if (cssLinks.length > 0) {
				const imports = cssLinks
					.map(({ href }) => {
						const resolved = path.resolve(htmlDir, href);
						return `@import ${JSON.stringify(resolved)};`;
					})
					.join("\n");

				const bundled = await esbuild({
					stdin: {
						contents: imports,
						resolveDir: htmlDir,
						loader: "css",
					},
					bundle: true,
					minify: false,
					write: false,
				});

				const rawCss = bundled.outputFiles[0].text;
				const beforeMin = await esbuildTransform(rawCss, {
					loader: "css",
					minify: true,
				});
				cssBytesBefore += Buffer.byteLength(beforeMin.code, "utf8");

				const prunedCss = prune ? CssPruner.prune(rawCss, usedTags) : rawCss;
				const minified = await esbuildTransform(prunedCss, {
					loader: "css",
					minify: true,
				});
				const finalCss = minified.code;
				cssBytesAfter += Buffer.byteLength(finalCss, "utf8");

				const baseName = path.basename(relHtml, ".html");
				const fileName = hash
					? `${baseName}.${shortHash(finalCss)}.css`
					: `${baseName}.css`;
				const outAsset = path.join(assetsDir, fileName);
				if (!emitted.has(outAsset)) {
					await fs.writeFile(outAsset, finalCss, "utf8");
					emitted.set(outAsset, Buffer.byteLength(finalCss, "utf8"));
				}

				const relAssetHref = path
					.relative(outHtmlDir, outAsset)
					.split(path.sep)
					.join("/");
				setAttr(cssLinks[0].node, "href", relAssetHref);

				// Remove redundant subsequent <link> tags
				for (let idx = 1; idx < cssLinks.length; idx++) {
					const target = cssLinks[idx].node;
					const siblings = target.parentNode?.childNodes;
					if (siblings) {
						const pos = siblings.indexOf(target);
						if (pos !== -1) siblings.splice(pos, 1);
					}
				}
			}

			// 3. Bundle & minify each local <script src="...">
			for (const { node, src } of scriptNodes) {
				const entryPath = path.resolve(htmlDir, src);
				const bundled = await esbuild({
					entryPoints: [entryPath],
					bundle: true,
					minify: true,
					format: "esm",
					write: false,
				});
				const finalJs = bundled.outputFiles[0].text;
				jsBytes += Buffer.byteLength(finalJs, "utf8");

				const baseName = path.basename(src, path.extname(src));
				const fileName = hash
					? `${baseName}.${shortHash(finalJs)}.js`
					: `${baseName}.js`;
				const outAsset = path.join(assetsDir, fileName);
				if (!emitted.has(outAsset)) {
					await fs.writeFile(outAsset, finalJs, "utf8");
					emitted.set(outAsset, Buffer.byteLength(finalJs, "utf8"));
				}

				const relAssetSrc = path
					.relative(outHtmlDir, outAsset)
					.split(path.sep)
					.join("/");
				setAttr(node, "src", relAssetSrc);
			}

			const serialized = serialize(doc);
			await fs.writeFile(outHtmlPath, serialized, "utf8");
			emitted.set(outHtmlPath, Buffer.byteLength(serialized, "utf8"));
		}

		// 4. Copy static companion files (locales/*.json, images, etc.)
		for (const file of allFiles) {
			if (
				file.endsWith(".html") ||
				file.endsWith(".js") ||
				file.endsWith(".css") ||
				file.endsWith(".d.ts") ||
				file.endsWith(".map")
			) {
				continue;
			}
			const rel = path.relative(absSrc, file);
			const dest = path.join(absOut, rel);
			await fs.mkdir(path.dirname(dest), { recursive: true });
			await fs.copyFile(file, dest);
			const stat = await fs.stat(dest);
			emitted.set(dest, stat.size);
		}

		return {
			outDir: absOut,
			htmlCount: htmlFiles.length,
			cssBytesBefore,
			cssBytesAfter,
			jsBytes,
			files: [...emitted.entries()].map(([file, bytes]) => ({
				file: path.relative(absOut, file),
				bytes,
			})),
		};
	}

	static async #walk(dir, absOut) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const results = [];
		for (const entry of entries) {
			const full = path.resolve(dir, entry.name);
			if (full === absOut) continue;
			if (entry.isDirectory()) {
				if (EXCLUDE_DIRS.has(entry.name) || entry.name.startsWith("."))
					continue;
				results.push(...(await Builder.#walk(full, absOut)));
			} else if (entry.isFile()) {
				results.push(full);
			}
		}
		return results;
	}
}
