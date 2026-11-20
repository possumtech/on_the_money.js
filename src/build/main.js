#!/usr/bin/env node
import BuildCli from "./cli.js";

const result = await BuildCli.run(process.argv.slice(2));
if (result !== 0) {
	process.exitCode = 1;
}
