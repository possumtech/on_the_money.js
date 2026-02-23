#!/usr/bin/env node
import Cli from "./cli.js";

const result = await Cli.run(process.argv.slice(2));
if (result !== 0) {
	process.exitCode = 1;
}
