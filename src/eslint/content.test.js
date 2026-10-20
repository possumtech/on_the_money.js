import assert from "node:assert/strict";
import test from "node:test";
import { Linter } from "eslint";
import config from "on_the_money/eslint-config";
import plugin from "on_the_money/eslint-plugin";

for (const [name, rules] of [
	["shareable config", config],
	["plugin recommended config", [plugin.configs.recommended]],
]) {
	test(`${name}: native document content needs no state mirror or lint suppression`, () => {
		const linter = new Linter();
		for (const code of [
			'const outlet = $("#document-body"); if (outlet.textContent !== body) outlet.textContent = body;',
			'outlet.textContent = "";',
			'outlet["textContent"] = body;',
			"text.nodeValue = body;",
			"outlet.innerText = body;",
			"outlet.replaceChildren(sanitizedFragment);",
		]) {
			assert.deepEqual(linter.verify(code, rules), [], code);
		}
	});

	test(`${name}: native content does not relax state, styling, or server-DOM rules`, () => {
		const linter = new Linter();
		for (const [code, ruleId, messageId] of [
			['the("body", { nested: "document" });', "otm/flat-state", "notFlat"],
			['outlet.style.color = "red";', "otm/no-style-mutation", "noStyle"],
			[
				'import { parseHTML } from "linkedom";',
				"otm/no-server-dom",
				"noServerDom",
			],
		]) {
			assert.deepEqual(
				linter
					.verify(code, rules)
					.map(({ ruleId, messageId }) => ({ ruleId, messageId })),
				[{ ruleId, messageId }],
			);
		}
	});
}
