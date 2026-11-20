import { parseArgs } from "node:util";
import Builder from "./Builder.js";

const formatBytes = (bytes) =>
	bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} KB`;

export default class BuildCli {
	static async run(args = []) {
		try {
			const { values, positionals } = parseArgs({
				args,
				allowPositionals: true,
				options: {
					out: { type: "string", short: "o", default: "dist" },
					"no-hash": { type: "boolean", default: false },
					help: { type: "boolean", short: "h", default: false },
				},
			});

			if (values.help) {
				console.log("Usage: otm-build [srcDir] [--out <dir>] [--no-hash]");
				return 0;
			}

			if (positionals.length > 1) {
				throw new TypeError("otm-build accepts at most one source directory");
			}

			const result = await Builder.build({
				srcDir: positionals[0] ?? ".",
				outDir: values.out,
				hash: !values["no-hash"],
			});

			console.log(`on_the_money.js Build → ${result.outDir}`);
			console.log(
				`  HTML: ${result.htmlCount} | JS: ${formatBytes(result.jsBytes)} | CSS: ${formatBytes(result.cssBytes)}`,
			);
			return 0;
		} catch (e) {
			console.error(`Build failed: ${e.message}`);
			return 1;
		}
	}
}
