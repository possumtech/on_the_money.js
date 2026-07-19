import assert from "node:assert";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import { clipboard } from "./index.js";

test("clipboard: absent API → null, no capability declared", (_t) => {
	const { document } = setupDOM();
	assert.strictEqual(clipboard(), null);
	assert.strictEqual(document.body.getAttribute("data-clipboard"), null);
});

test("clipboard: declares capability, copies on click, pulses data-copied", async (t) => {
	const { document } = setupDOM(
		'<button data-copy="npm install on_the_money" data-i18n="copy-cmd">Copy</button>',
	);
	const writes = [];
	globalThis.navigator.clipboard = {
		writeText: async (s) => {
			writes.push(s);
		},
	};
	t.mock.timers.enable({ apis: ["setTimeout"] });

	const off = clipboard({ resetMs: 100 });
	assert.strictEqual(typeof off, "function");
	assert.strictEqual(document.body.getAttribute("data-clipboard"), "available");

	const button = document.querySelector("[data-copy]");
	button.click();
	await Promise.resolve();
	assert.deepStrictEqual(writes, ["npm install on_the_money"]);
	assert.strictEqual(button.getAttribute("data-copied"), "true");

	t.mock.timers.tick(120);
	assert.strictEqual(button.getAttribute("data-copied"), "false");
	off();
});
