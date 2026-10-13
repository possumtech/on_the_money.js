import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const result = await build({
	absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
	entryPoints: ["src/core/index.js"],
	bundle: true,
	minify: true,
	format: "esm",
	write: false,
	metafile: true,
});
const bytes = result.outputFiles[0].contents;
console.log(
	JSON.stringify(
		{
			minifiedBytes: bytes.length,
			gzipBytes: gzipSync(bytes).length,
			inputs: Object.keys(result.metafile.inputs),
		},
		null,
		2,
	),
);
