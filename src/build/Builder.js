import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { serialize } from "parse5";
import Markup from "../linter/Markup.js";
import CssPruner from "./CssPruner.js";

const EXCLUDE_DIRS = new Set(["node_modules", "dist", ".git"]);
const EXTERNAL_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

const ASSET_LOADERS = {
	".woff": "file",
	".woff2": "file",
	".ttf": "file",
	".otf": "file",
	".eot": "file",
	".svg": "file",
	".png": "file",
	".jpg": "file",
	".jpeg": "file",
	".gif": "file",
	".webp": "file",
	".avif": "file",
	".ico": "file",
};

const shortHash = (buf) =>
	crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);

const toPosix = (filePath) => filePath.split(path.sep).join("/");

const isLocalRef = (href) => Boolean(href && !EXTERNAL_URL_RE.test(href));

const splitRef = (ref) => {
	const idx = ref.search(/[?#]/);
	return idx === -1
		? { pathname: ref, suffix: "" }
		: { pathname: ref.slice(0, idx), suffix: ref.slice(idx) };
};

const resolveLocalRef = (ref, htmlDir, absSrc) => {
	const { pathname } = splitRef(ref);
	const rootRelative = pathname.startsWith("/");
	const resolved = rootRelative
		? path.resolve(absSrc, pathname.slice(1))
		: path.resolve(htmlDir, pathname);
	return { resolved, rootRelative };
};

const formatAssetUrl = (absAsset, outHtmlDir, absOut, rootRelative) => {
	if (rootRelative) {
		return `/${toPosix(path.relative(absOut, absAsset))}`;
	}
	return toPosix(path.relative(outHtmlDir, absAsset));
};

const entryKeyForPath = (entryPath, absSrc) => {
	const rel = path.relative(absSrc, entryPath);
	const ext = path.extname(entryPath);
	if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
		return toPosix(rel.slice(0, ext ? -ext.length : undefined));
	}
	const base = path.basename(entryPath, ext);
	return `_ext/${base}.${shortHash(entryPath)}`;
};

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
	static async #loadEsbuild() {
		try {
			return await import("esbuild");
		} catch (error) {
			if (
				error?.code === "ERR_MODULE_NOT_FOUND" ||
				error?.code === "MODULE_NOT_FOUND"
			) {
				throw new Error(
					'otm-build requires the optional peer dependency "esbuild". Install it with: npm install -D esbuild',
					{ cause: error },
				);
			}
			throw error;
		}
	}

	static async build({
		srcDir = ".",
		outDir = "dist",
		prune = false,
		hash = true,
	} = {}) {
		const { build: esbuild, transform: esbuildTransform } =
			await Builder.#loadEsbuild();

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

		const usedTags = prune ? CssPruner.collectUsedTags(htmlSources) : null;

		await fs.mkdir(absOut, { recursive: true });
		const assetsDir = path.join(absOut, "assets");
		await fs.mkdir(assetsDir, { recursive: true });

		const emitted = new Map();
		let cssBytesBefore = 0;
		let cssBytesAfter = 0;
		let jsBytes = 0;

		// Pass 1: parse all HTML documents and collect CSS links and script entries
		const pages = [];
		const moduleEntries = new Map();
		const classicEntries = new Map();

		for (const { file, source } of htmlSources) {
			const relHtml = path.relative(absSrc, file);
			const htmlDir = path.dirname(file);
			const outHtmlPath = path.join(absOut, relHtml);
			const outHtmlDir = path.dirname(outHtmlPath);
			const doc = Markup.parse(file, source);

			const cssLinks = [];
			const scriptNodes = [];
			const walk = (node) => {
				if (node.nodeName === "link") {
					const rel = (getAttr(node, "rel") || "").toLowerCase();
					const href = getAttr(node, "href");
					if (rel === "stylesheet" && isLocalRef(href)) {
						const { resolved, rootRelative } = resolveLocalRef(
							href,
							htmlDir,
							absSrc,
						);
						cssLinks.push({ node, href, resolved, rootRelative });
					}
				} else if (node.nodeName === "script") {
					const src = getAttr(node, "src");
					if (isLocalRef(src)) {
						const { resolved, rootRelative } = resolveLocalRef(
							src,
							htmlDir,
							absSrc,
						);
						const isModule =
							(getAttr(node, "type") || "").trim().toLowerCase() === "module";
						const key = entryKeyForPath(resolved, absSrc);
						if (isModule) {
							moduleEntries.set(resolved, key);
						} else {
							classicEntries.set(resolved, key);
						}
						scriptNodes.push({ node, resolved, rootRelative, isModule });
					}
				}
				for (const child of node.childNodes || []) walk(child);
			};
			walk(doc);

			pages.push({
				relHtml,
				htmlDir,
				outHtmlPath,
				outHtmlDir,
				doc,
				cssLinks,
				scriptNodes,
			});
		}

		// Pass 2: bundle scripts (ESM with native code-splitting; classic scripts as IIFE)
		const bundleScriptGroup = async (entriesMap, isModule) => {
			const outByEntry = new Map();
			if (entriesMap.size === 0) return outByEntry;

			const entryPoints = Object.fromEntries(
				[...entriesMap.entries()].map(([entryPath, key]) => [key, entryPath]),
			);
			const bundled = await esbuild({
				entryPoints,
				bundle: true,
				minify: true,
				format: isModule ? "esm" : "iife",
				splitting: isModule,
				outdir: assetsDir,
				entryNames: hash ? "[dir]/[name].[hash]" : "[dir]/[name]",
				chunkNames: hash ? "chunks/[name].[hash]" : "chunks/[name]",
				assetNames: hash ? "media/[name].[hash]" : "media/[name]",
				loader: ASSET_LOADERS,
				metafile: true,
				write: true,
			});

			for (const [outRel, info] of Object.entries(bundled.metafile.outputs)) {
				const absOutFile = path.resolve(outRel);
				emitted.set(absOutFile, info.bytes);
				if (absOutFile.endsWith(".js")) {
					jsBytes += info.bytes;
				}
				if (info.entryPoint) {
					outByEntry.set(path.resolve(info.entryPoint), absOutFile);
				}
			}

			return outByEntry;
		};

		const moduleOutPaths = await bundleScriptGroup(moduleEntries, true);
		const classicOutPaths = await bundleScriptGroup(classicEntries, false);

		// Pass 3: bundle CSS per page (preserving url() assets, opt-in pruning) and write HTML
		for (const page of pages) {
			const {
				relHtml,
				htmlDir,
				outHtmlPath,
				outHtmlDir,
				doc,
				cssLinks,
				scriptNodes,
			} = page;
			await fs.mkdir(outHtmlDir, { recursive: true });

			if (cssLinks.length > 0) {
				const pageStem = toPosix(relHtml.slice(0, -5));
				const virtualId = `otm-css-entry:${pageStem}`;
				const imports = cssLinks
					.map(({ resolved }) => `@import ${JSON.stringify(resolved)};`)
					.join("\n");

				const bundled = await esbuild({
					entryPoints: { [pageStem]: virtualId },
					bundle: true,
					minify: !prune,
					write: false,
					outdir: assetsDir,
					entryNames: "[dir]/[name]",
					assetNames: hash ? "media/[name].[hash]" : "media/[name]",
					loader: ASSET_LOADERS,
					plugins: [
						{
							name: "otm-css-virtual-entry",
							setup(build) {
								build.onResolve({ filter: /^otm-css-entry:/ }, (args) => ({
									path: args.path,
									namespace: "otm-css-entry",
								}));
								build.onLoad(
									{ filter: /.*/, namespace: "otm-css-entry" },
									() => ({
										contents: imports,
										resolveDir: htmlDir,
										loader: "css",
									}),
								);
							},
						},
					],
				});

				const expectedCssPath = path.join(assetsDir, `${pageStem}.css`);
				let cssOutput = null;
				for (const outputFile of bundled.outputFiles) {
					if (path.resolve(outputFile.path) === path.resolve(expectedCssPath)) {
						cssOutput = outputFile;
					} else if (!emitted.has(outputFile.path)) {
						await fs.mkdir(path.dirname(outputFile.path), { recursive: true });
						await fs.writeFile(outputFile.path, outputFile.contents);
						emitted.set(outputFile.path, outputFile.contents.byteLength);
					}
				}

				const rawCss = cssOutput.text;
				let finalCss = rawCss;
				if (prune) {
					const beforeMin = await esbuildTransform(rawCss, {
						loader: "css",
						minify: true,
					});
					cssBytesBefore += Buffer.byteLength(beforeMin.code, "utf8");

					const prunedCss = CssPruner.prune(rawCss, usedTags);
					const minified = await esbuildTransform(prunedCss, {
						loader: "css",
						minify: true,
					});
					finalCss = minified.code;
					cssBytesAfter += Buffer.byteLength(finalCss, "utf8");
				} else {
					const bytes = Buffer.byteLength(finalCss, "utf8");
					cssBytesBefore += bytes;
					cssBytesAfter += bytes;
				}

				const cssDir = path.dirname(expectedCssPath);
				const cssBase = path.basename(expectedCssPath, ".css");
				const fileName = hash
					? `${cssBase}.${shortHash(finalCss)}.css`
					: `${cssBase}.css`;
				const outAsset = path.join(cssDir, fileName);
				await fs.mkdir(cssDir, { recursive: true });
				await fs.writeFile(outAsset, finalCss, "utf8");
				emitted.set(outAsset, Buffer.byteLength(finalCss, "utf8"));

				const relAssetHref = formatAssetUrl(
					outAsset,
					outHtmlDir,
					absOut,
					cssLinks[0].rootRelative,
				);
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

			for (const { node, resolved, rootRelative, isModule } of scriptNodes) {
				const outAsset = (isModule ? moduleOutPaths : classicOutPaths).get(
					resolved,
				);
				const relAssetSrc = formatAssetUrl(
					outAsset,
					outHtmlDir,
					absOut,
					rootRelative,
				);
				setAttr(node, "src", relAssetSrc);
			}

			const serialized = serialize(doc);
			await fs.writeFile(outHtmlPath, serialized, "utf8");
			emitted.set(outHtmlPath, Buffer.byteLength(serialized, "utf8"));
		}

		// Pass 4: copy static companion files (locales/*.json, images, etc.)
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
