import assert from "node:assert";
import test from "node:test";
import { RuleTester } from "eslint";
import pkg from "../../package.json" with { type: "json" };
import plugin from "./plugin.js";

const tester = new RuleTester({
	languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});

test("prefer-on", () => {
	tester.run("prefer-on", plugin.rules["prefer-on"], {
		valid: [
			{ code: 'on(document.body, "click", ".btn", fn);' },
			{ code: 'on.emit(el, "x", {});' },
		],
		invalid: [
			{
				code: 'el.addEventListener("click", fn);',
				errors: [{ messageId: "useOn" }],
			},
			{
				code: 'window.addEventListener("popstate", fn);',
				errors: [{ messageId: "useOn" }],
			},
		],
	});
});

test("prefer-the-set", () => {
	tester.run("prefer-the-set", plugin.rules["prefer-the-set"], {
		valid: [
			{ code: 'the(el, "title", "x");' },
			{ code: "const x = el.textContent;" },
		],
		invalid: [
			{
				code: 'el.textContent = "x";',
				errors: [{ messageId: "useThe" }],
			},
			{
				code: 'el.innerText = "x";',
				errors: [{ messageId: "useThe" }],
			},
			{
				code: 'node.nodeValue = "x";',
				errors: [{ messageId: "useThe" }],
			},
		],
	});
});

test("flat-state", () => {
	tester.run("flat-state", plugin.rules["flat-state"], {
		valid: [
			{ code: 'the("theme", "dark");' },
			{ code: 'the(el, "active", "true");' },
			{ code: 'the({ a: "1", b: "2" });' },
			{ code: 'the(el, { a: "1", b: "2" });' },
		],
		invalid: [
			{
				code: 'the("user", { name: "x" });',
				errors: [{ messageId: "notFlat" }],
			},
			{
				code: 'the("tags", ["a", "b"]);',
				errors: [{ messageId: "notFlat" }],
			},
			{
				code: 'the(el, "data", { x: 1 });',
				errors: [{ messageId: "notFlat" }],
			},
			{
				code: 'the({ user: { name: "x" } });',
				errors: [{ messageId: "notFlat" }],
			},
		],
	});
});

test("prefer-submit", () => {
	tester.run("prefer-submit", plugin.rules["prefer-submit"], {
		valid: [
			{ code: 'on("#form", "submit", (e) => {});' },
			{ code: 'on("#nav", "click", "a", fn);' },
		],
		invalid: [
			{
				code: 'on("#parent", "click", "button.go", fn);',
				errors: [{ messageId: "useSubmit" }],
			},
			{
				code: 'on(form, "click", "button", fn);',
				errors: [{ messageId: "useSubmit" }],
			},
		],
	});
});

test("no-style-mutation", () => {
	tester.run("no-style-mutation", plugin.rules["no-style-mutation"], {
		valid: [
			{ code: 'the(el, "theme", "dark");' },
			{ code: 'el.setAttribute("data-x", "y");' },
			{ code: "const c = el.style.color;" },
		],
		invalid: [
			{
				code: 'el.style.color = "red";',
				errors: [{ messageId: "noStyle" }],
			},
			{
				code: 'el.style.setProperty("color", "red");',
				errors: [{ messageId: "noStyle" }],
			},
		],
	});
});

test("no-server-dom", () => {
	tester.run("no-server-dom", plugin.rules["no-server-dom"], {
		valid: [
			{ code: 'import { the } from "on_the_money";' },
			{ code: 'import fs from "node:fs/promises";' },
			{ code: 'import express from "express";' },
		],
		invalid: [
			{
				code: 'import { parseHTML } from "linkedom";',
				errors: [{ messageId: "noServerDom" }],
			},
			{
				code: 'import jsdom from "jsdom";',
				errors: [{ messageId: "noServerDom" }],
			},
			{
				code: 'import cheerio from "cheerio";',
				errors: [{ messageId: "noServerDom" }],
			},
			{
				code: 'import parse5 from "parse5";',
				errors: [{ messageId: "noServerDom" }],
			},
		],
	});
});

test("no-document-query", () => {
	tester.run("no-document-query", plugin.rules["no-document-query"], {
		valid: [
			{ code: '$(".x")' },
			{ code: '$$(".x")' },
			{ code: "$.clone('#parent', '#tmpl')" },
			{ code: "const b = document.body;" },
			{ code: "const t = document.title;" },
			{ code: "on(document.body, 'click', '.btn', fn);" },
		],
		invalid: [
			{
				code: 'document.querySelector(".x");',
				errors: [{ messageId: "noDocumentQuery" }],
			},
			{
				code: 'document.querySelectorAll(".x");',
				errors: [{ messageId: "noDocumentQuery" }],
			},
			{
				code: 'document.getElementById("x");',
				errors: [{ messageId: "noDocumentQuery" }],
			},
			{
				code: 'document.createElement("div");',
				errors: [{ messageId: "noDocumentQuery" }],
			},
			{
				code: 'document.write("x");',
				errors: [{ messageId: "noDocumentQuery" }],
			},
		],
	});
});

test("no-raw-websocket", () => {
	tester.run("no-raw-websocket", plugin.rules["no-raw-websocket"], {
		valid: [
			{ code: 'const ch = live("/ws", { onMessage });' },
			{ code: "const wss = new WebSocketServer({ noServer: true });" },
			{
				code: 'import WebSocket from "ws"; const s = new WebSocket(url, { headers });',
			},
			{
				code: 'const { WebSocket } = await import("ws"); new WebSocket(url);',
			},
		],
		invalid: [
			{
				code: 'new WebSocket("wss://example.test/ws");',
				errors: [{ messageId: "useLive" }],
			},
			{
				code: "const s = new WebSocket(url);",
				errors: [{ messageId: "useLive" }],
			},
		],
	});
});

test("plugin: exports meta and configs.recommended", () => {
	assert.strictEqual(plugin.meta.name, "eslint-plugin-otm");
	assert.ok(plugin.configs.recommended.rules);
	assert.strictEqual(
		plugin.configs.recommended.rules["otm/prefer-on"],
		"error",
	);
});

test("plugin: meta.version is single-sourced from package.json", () => {
	assert.strictEqual(plugin.meta.version, pkg.version);
});
