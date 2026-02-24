import fs from "node:fs/promises";
import path from "node:path";
import Linter from "./Linter.js";

export default class Cli {
	static async run(args = []) {
		console.log("on_the_money.js Linter (Experimental)");

		if (args.includes("--check")) {
			const dirIndex = args.indexOf("--check") + 1;
			const targetDir = args[dirIndex] || ".";
			try {
				return await Cli.scan(targetDir);
			} catch (e) {
				console.error(`Error scanning ${targetDir}: ${e.message}`);
				return -1;
			}
		}
		return 0;
	}

	static async scan(dir) {
		const files = await Cli.getFiles(dir);
		let totalViolations = 0;

		// 1. Pre-scan for i18n config to find locales folder
		let availableLocales = null;
		for (const file of files) {
			if (file.endsWith(".html")) {
				const source = await fs.readFile(file, "utf-8");
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
					} catch {
						// Folder not found or unreadable
					}
					break;
				}
			}
		}

		for (const file of files) {
			const source = await fs.readFile(file, "utf-8");
			const violations = Linter.check(file, source, availableLocales);

			if (violations.length > 0) {
				totalViolations += violations.length;
				Cli.report(file, violations);
			}
		}

		if (totalViolations === 0) {
			console.log("✔ No violations found.");
		} else {
			console.log(
				`\n✖ Found ${totalViolations} violations across ${files.length} files.`,
			);
		}
		return totalViolations;
	}

	static async getFiles(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const files = await Promise.all(
			entries.map((res) => {
				const resPath = path.resolve(dir, res.name);
				return res.isDirectory() ? Cli.getFiles(resPath) : resPath;
			}),
		);
		return Array.prototype.concat
			.apply([], files)
			.filter((f) => [".js", ".html", ".css"].includes(path.extname(f)));
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
