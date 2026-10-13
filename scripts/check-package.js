import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json")));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "otm-package-"));
const npm = async (args, cwd) => {
	const result = await exec("npm", args, {
		cwd,
		timeout: 120000,
		maxBuffer: 4 * 1024 * 1024,
	});
	return result.stdout;
};

try {
	const packed = JSON.parse(
		await npm(
			["pack", "--ignore-scripts", "--json", "--pack-destination", temporary],
			root,
		),
	);
	const artifacts = Object.values(packed);
	assert.equal(artifacts.length, 1);
	const artifact = path.join(temporary, artifacts[0].filename);
	for (const withStylelint of [false, true]) {
		const name = withStylelint ? "stylelint-consumer" : "runtime-consumer";
		const cwd = path.join(temporary, name);
		await fs.mkdir(cwd);
		await fs.writeFile(
			path.join(cwd, "package.json"),
			JSON.stringify({
				name,
				private: true,
				type: "module",
				dependencies: {
					[pkg.name]: `file:${artifact}`,
					...(withStylelint
						? { stylelint: pkg.devDependencies.stylelint }
						: {}),
				},
				...(withStylelint ? { overrides: pkg.overrides } : {}),
			}),
		);
		await npm(["install", "--ignore-scripts", "--fund=false"], cwd);
		const audit = JSON.parse(await npm(["audit", "--json"], cwd));
		assert.equal(audit.metadata.vulnerabilities.total, 0);
		const source = withStylelint
			? `
				import assert from "node:assert/strict";
				import stylelint from "stylelint";
				import config from "on_the_money/stylelint-config";
				const good = await stylelint.lint({code: "[data-state] { color: red; }", config});
				assert.equal(good.errored, false);
				const bad = await stylelint.lint({code: ".active { color: red !important; }", config});
				assert.deepEqual(bad.results[0].warnings.map(({rule}) => rule).sort(),
					["declaration-no-important", "otm/prefer-attribute-selector"]);
				const pattern = "**/" + "{".repeat(4900) + "a,b" + "}".repeat(4900);
				await assert.rejects(stylelint.lint({files: pattern, config}), {
					name: "SyntaxError", message: "Input depth (101), exceeds max depth (100)"
				});
			`
			: `
				import assert from "node:assert/strict";
				import {createRequire} from "node:module";
				import {the} from "on_the_money";
				const require = createRequire(import.meta.url);
				assert.equal(typeof the.boot, "function");
				assert.throws(() => require.resolve("stylelint"), {code: "MODULE_NOT_FOUND"});
				assert.throws(() => require.resolve("braces"), {code: "MODULE_NOT_FOUND"});
			`;
		await exec(process.execPath, ["--input-type=module", "-e", source], {
			cwd,
			timeout: 10000,
		});
		console.log(
			`${name}: packed imports, public contracts, and full audit passed`,
		);
	}
} finally {
	await fs.rm(temporary, { recursive: true, force: true });
}
