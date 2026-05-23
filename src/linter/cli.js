import fs from "node:fs/promises";
import path from "node:path";
import Linter from "./Linter.js";

export default class Cli {
	static async run(args = []) {
		console.log("on_the_money.js Linter (Experimental)");

		const wantConformance = args.includes("--conformance");

		if (args.includes("--check")) {
			const dirIndex = args.indexOf("--check") + 1;
			const targetDir = args[dirIndex] || ".";
			try {
				const total = await Cli.scan(targetDir, { wantConformance });
				return total;
			} catch (e) {
				console.error(`Error scanning ${targetDir}: ${e.message}`);
				return -1;
			}
		}
		return 0;
	}

	static #excludeDirs = new Set(["node_modules", "dist", ".git"]);

	static async getFiles(dir, exts = [".html"]) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const files = await Promise.all(
			entries.map((res) => {
				const resPath = path.resolve(dir, res.name);
				if (res.isDirectory()) {
					if (Cli.#excludeDirs.has(res.name) || res.name.startsWith("."))
						return [];
					return Cli.getFiles(resPath, exts);
				}
				return resPath;
			}),
		);
		return Array.prototype.concat
			.apply([], files)
			.filter((f) => exts.includes(path.extname(f)));
	}

	static async scan(dir, opts = {}) {
		const allFiles = await Cli.getFiles(dir, [".html", ".js", ".json"]);
		const htmlPaths = allFiles.filter((f) => f.endsWith(".html"));
		const jsPaths = allFiles.filter((f) => f.endsWith(".js"));
		let totalViolations = 0;

		const htmlSources = [];
		for (const file of htmlPaths) {
			const source = await fs.readFile(file, "utf-8");
			let availableLocales = null;
			const dicts = [];

			const match = source.match(/<meta\s+name="i18n"\s+content="([^"]+)"/);
			if (match) {
				const localesDir = path.resolve(
					path.dirname(file),
					match[1].startsWith("/") ? `.${match[1]}` : match[1],
				);
				try {
					const entries = await fs.readdir(localesDir);
					availableLocales = entries
						.filter((f) => f.endsWith(".json"))
						.map((f) => f.replace(".json", ""));
					for (const entry of entries) {
						if (!entry.endsWith(".json")) continue;
						const locale = entry.replace(".json", "");
						try {
							const raw = await fs.readFile(
								path.join(localesDir, entry),
								"utf-8",
							);
							dicts.push({ locale, dict: JSON.parse(raw) });
						} catch {
							// Skip unparseable locale file
						}
					}
				} catch {
					// Folder not found or unreadable
				}
			}

			const violations = Linter.check(file, source, availableLocales);
			htmlSources.push({ file, source, dicts });

			if (violations.length > 0) {
				totalViolations += violations.length;
				Cli.report(file, violations);
			}
		}

		const jsSources = [];
		for (const file of jsPaths) {
			const source = await fs.readFile(file, "utf-8");
			jsSources.push({ file, source });
		}

		const crossViolations = Linter.crossCheck({
			htmlSources,
			jsSources,
		});

		if (crossViolations.length > 0) {
			const byFile = new Map();
			for (const v of crossViolations) {
				if (!byFile.has(v.file)) byFile.set(v.file, []);
				byFile.get(v.file).push(v);
			}
			for (const [file, vs] of byFile) Cli.report(file, vs);
			totalViolations += crossViolations.length;
		}

		if (totalViolations === 0) {
			console.log("✔ No violations found.");
		} else {
			console.log(
				`\n✖ Found ${totalViolations} violations across ${htmlPaths.length} HTML files.`,
			);
		}

		if (opts.wantConformance) {
			console.log(`OTM conformance: ${totalViolations} violations`);
		}

		return totalViolations;
	}

	static report(file, violations) {
		console.log(`\nIn ${file}:`);
		for (const v of violations) {
			console.log(
				`  [${v.ruleId}] Line ${v.line}, Col ${v.column}: ${v.message}`,
			);
		}
	}
}
