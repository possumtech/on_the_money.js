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
				const violations = await Cli.scan(targetDir);
				if (violations > 0) {
					process.exitCode = 1;
				}
			} catch (e) {
				console.error(`Error scanning ${targetDir}: ${e.message}`);
				return false;
			}
			return true;
		}
		return false;
	}

	static async scan(dir) {
		const files = await Cli.getFiles(dir);
		let totalViolations = 0;

		for (const file of files) {
			const source = await fs.readFile(file, "utf-8");
			const violations = Linter.check(file, source);

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
		return Array.prototype
			.concat(...files)
			.filter((f) => [".js", ".html", ".css"].includes(path.extname(f)));
	}

	static report(file, violations) {
		console.log(`\nIn ${file}:`);
		violations.forEach((v) => {
			console.log(
				`  [${v.ruleId}] Line ${v.line}, Col ${v.column}: ${v.message}`,
			);
		});
	}
}
