import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
let origin;
let server;

test.beforeAll(async () => {
	server = http.createServer(async (request, response) => {
		const pathname = new URL(request.url, "http://localhost").pathname;
		if (pathname === "/") {
			response.writeHead(200, { "content-type": "text/html" });
			response.end("<!doctype html><html><body></body></html>");
			return;
		}
		const file = path.resolve(root, `.${pathname}`);
		if (!file.startsWith(`${root}${path.sep}`)) {
			response.writeHead(403).end();
			return;
		}
		try {
			const source = await fs.readFile(file);
			response.writeHead(200, { "content-type": "text/javascript" });
			response.end(source);
		} catch {
			response.writeHead(404).end();
		}
	});
	await new Promise((resolve) =>
		server.listen(0, "127.0.0.1", () => resolve()),
	);
	const { port } = server.address();
	origin = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
	await new Promise((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
});

test.beforeEach(async ({ page }) => {
	await page.goto(origin);
});

test("state projection, deletion, persistence, and runtime contract", async ({
	page,
}) => {
	const result = await page.evaluate(async () => {
		const { the } = await import("/src/core/index.js");
		document.body.innerHTML = '<output data-text="count">fallback</output>';
		await the.boot({ dictionary: {}, persistKeys: ["count"] });
		the("count", 7);
		const written = {
			attr: document.body.getAttribute("data-count"),
			text: document.querySelector("output").textContent,
			stored: localStorage.getItem("otm:count"),
		};
		document.body.removeAttribute("data-count");
		await the.boot({ dictionary: {}, persistKeys: ["count"] });
		const replayed = document.body.getAttribute("data-count");
		the("count", null);
		let rejected = false;
		try {
			the("bad", Number.NaN);
		} catch (error) {
			rejected = error instanceof TypeError;
		}
		return {
			written,
			replayed,
			deleted: !document.body.hasAttribute("data-count"),
			rejected,
		};
	});
	expect(result).toEqual({
		written: { attr: "7", text: "7", stored: "7" },
		replayed: "7",
		deleted: true,
		rejected: true,
	});
});

test("native form extraction and unsafe-path rejection", async ({ page }) => {
	const result = await page.evaluate(async () => {
		const { the } = await import("/src/core/index.js");
		document.body.innerHTML = `
			<form id="safe">
				<input name="user[name]" value="Ada">
				<select name="tags[]" multiple>
					<option value="a" selected>A</option>
					<option value="b" selected>B</option>
				</select>
				<input type="file" name="ignored">
			</form>
			<form id="unsafe">
				<input name="user[__proto__][polluted]" value="yes">
			</form>
		`;
		const value = the.form(document.querySelector("#safe"));
		let rejected = false;
		try {
			the.form(document.querySelector("#unsafe"));
		} catch (error) {
			rejected = error instanceof TypeError;
		}
		return { value, rejected, polluted: Object.prototype.polluted ?? null };
	});
	expect(result).toEqual({
		value: { user: { name: "Ada" }, tags: ["a", "b"] },
		rejected: true,
		polluted: null,
	});
});

test("delegated events unsubscribe and localized templates mount", async ({
	page,
}) => {
	const result = await page.evaluate(async () => {
		const { $, on, the } = await import("/src/core/index.js");
		document.body.innerHTML = `
			<main id="items"></main>
			<template id="item"><button data-action="pick" data-i18n="pick">Pick</button></template>
		`;
		the.dictionary = { pick: "Choose" };
		let clicks = 0;
		const off = on(document.body, "click", '[data-action="pick"]', () => {
			clicks += 1;
		});
		const button = $.clone("#items", "#item");
		button.click();
		off();
		button.click();
		return { clicks, text: button.textContent, connected: button.isConnected };
	});
	expect(result).toEqual({ clicks: 1, text: "Choose", connected: true });
});

test("router navigation, same-URL no-op, and unsubscribe", async ({ page }) => {
	const result = await page.evaluate(async () => {
		const { route } = await import("/src/core/index.js");
		const visits = [];
		const off = route((pathname) => visits.push(pathname));
		route.go("/next");
		route.go("/next");
		off();
		window.history.pushState({}, "", "/after");
		window.dispatchEvent(new PopStateEvent("popstate"));
		return { visits, pathname: window.location.pathname };
	});
	expect(result).toEqual({
		visits: ["/", "/next"],
		pathname: "/after",
	});
});
