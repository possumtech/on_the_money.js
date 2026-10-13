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
			const types = {
				".html": "text/html",
				".css": "text/css",
				".js": "text/javascript",
				".json": "application/json",
			};
			response.writeHead(200, {
				"content-type": types[path.extname(file)] || "application/octet-stream",
			});
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

test.describe("example applications", () => {
	const errorsByPage = new WeakMap();
	test.use({ locale: "en-US", timezoneId: "UTC" });
	test.beforeEach(async ({ page }) => {
		const errors = [];
		errorsByPage.set(page, errors);
		page.on("pageerror", (error) => errors.push(error.message));
		await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
		// Functional flows use the real local CSS; the decorative CDN is not a prerequisite.
		await page.route("https://unpkg.com/**", (route) =>
			route.fulfill({ contentType: "text/css", body: "" }),
		);
	});
	test.afterEach(async ({ page }) => {
		expect(errorsByPage.get(page)).toEqual([]);
	});
	const open = async (page, app, search = "") => {
		await page.goto(`${origin}/examples/${app}/index.html${search}`);
		await page.evaluate(async (module) => {
			await import(module);
		}, `/examples/${app}/app.js`);
	};

	test("Todo add, toggle, and delete update singular/plural counts without navigating", async ({
		page,
	}) => {
		await open(page, "todo");
		const count = page.locator('[data-i18n="items_left"]');
		const items = page.locator("#todo-list [data-item]");
		expect(await count.textContent()).toBe("0 items left");
		for (const [task, expected] of [
			["First task", "1 item left"],
			["Second task", "2 items left"],
		]) {
			await page.getByRole("textbox", { name: "New Todo Task" }).fill(task);
			await page.getByRole("button", { name: "Add", exact: true }).click();
			await expect(count).toHaveText(expected);
		}
		await expect(items).toHaveCount(2);
		await expect(items.nth(0).locator('[data-text="task"]')).toHaveText(
			"First task",
		);
		await items.nth(0).getByRole("checkbox").check();
		await expect(count).toHaveText("1 item left");
		await expect(items.nth(0)).toHaveAttribute("data-done", "true");
		await items.nth(0).getByRole("checkbox").uncheck();
		await expect(count).toHaveText("2 items left");
		await items.nth(0).getByRole("button", { name: "Delete Task" }).click();
		await expect(count).toHaveText("1 item left");
		await items.nth(0).getByRole("button", { name: "Delete Task" }).click();
		await expect(items).toHaveCount(0);
		await expect(count).toHaveText("0 items left");
		await expect(page).toHaveURL(`${origin}/examples/todo/index.html`);
	});

	test("Blog initializes, navigates posts, and retains submitted comments", async ({
		page,
	}) => {
		await open(page, "blog");
		await expect(page.locator('[data-i18n="post_count"]')).toHaveText(
			"3 posts",
		);
		await expect(page.locator("#post-list [data-item]")).toHaveCount(3);
		await page.locator("#post-list a").first().click();
		await expect(page.locator("#post-view")).toBeVisible();
		await expect(page.locator("#post-view h1")).toHaveText(
			"Why state should live in the DOM",
		);
		await expect(page.locator('[data-i18n="posted_at"]')).toHaveText(
			"Posted 10/16/2026",
		);
		const count = page.locator('[data-i18n="comments_count"]');
		await expect(count).toHaveText("0 comments");
		for (const [text, expected] of [
			["First comment", "1 comment"],
			["Second comment", "2 comments"],
		]) {
			await page.locator("#comment-input").fill(text);
			await page.locator('#comment-form button[type="submit"]').click();
			await expect(count).toHaveText(expected);
		}
		await expect(page.locator('#comments-list [data-text="text"]')).toHaveText([
			"First comment",
			"Second comment",
		]);
		await page.locator('nav a[href="#/"]').click();
		await expect(page.locator('[data-route="home"]')).toBeVisible();
		await page.locator("#post-list a").first().click();
		await expect(count).toHaveText("2 comments");
		await page.locator('nav a[href="#/"]').click();
		await page.locator("#post-list a").nth(1).click();
		await expect(count).toHaveText("0 comments");
		await expect(page.locator("#comments-list [data-item]")).toHaveCount(0);
	});

	for (const search of ["", "?lang=fr-CA"]) {
		test(`Blog language changes preserve live quantities and formatted dates (${search || "source"})`, async ({
			page,
		}) => {
			await open(page, "blog", search);
			await expect(page.locator('[data-i18n="post_count"]')).toHaveText(
				search ? "3 articles" : "3 posts",
			);
			await page.locator("#post-list a").first().click();
			for (const [lang, zero, one, two, date] of [
				[
					"fr",
					"0 commentaire",
					"1 commentaire",
					"2 commentaires",
					"Publié le 16/10/2026",
				],
				[
					"es",
					"0 comentarios",
					"1 comentario",
					"2 comentarios",
					"Publicado 16/10/2026",
				],
				["en", "0 comments", "1 comment", "2 comments", "Posted 10/16/2026"],
			]) {
				await page.locator("#lang-select").selectOption(lang);
				await expect(page.locator('[data-i18n="posted_at"]')).toHaveText(date);
				const count = page.locator('[data-i18n="comments_count"]');
				if (lang === "fr") {
					await expect(count).toHaveText(zero);
					await page.locator("#comment-input").fill("First comment");
					await page.locator('#comment-form button[type="submit"]').click();
					await expect(count).toHaveText(one);
					await page.locator("#comment-input").fill("Second comment");
					await page.locator('#comment-form button[type="submit"]').click();
				}
				await expect(count).toHaveText(two);
				await expect(count).toHaveAttribute("lang", lang);
			}
			await expect(page.locator("#comments-list [data-item]")).toHaveCount(2);
			await expect(page.locator("html")).toHaveAttribute("lang", "en");
		});
	}

	test("Blog partial and failed translations retain dynamic source messages", async ({
		page,
	}) => {
		let fail = false;
		await page.route("**/examples/blog/locales/fr.json", (route) =>
			fail
				? route.fulfill({ status: 503, body: "Unavailable" })
				: route.fulfill({ json: { nav_home: "Accueil" } }),
		);
		await open(page, "blog");
		await page.locator("#post-list a").first().click();
		await page.locator("#lang-select").selectOption("fr");
		await expect(page.locator('[data-i18n="nav_home"]')).toHaveText("Accueil");
		const count = page.locator('[data-i18n="comments_count"]');
		await expect(count).toHaveText("0 comments");
		await expect(count).toHaveAttribute("lang", "en");
		await page.locator("#comment-input").fill("A comment");
		await page.locator('#comment-form button[type="submit"]').click();
		await expect(count).toHaveText("1 comment");
		await expect(page.locator('[data-i18n="posted_at"]')).toHaveText(
			"Posted 10/16/2026",
		);
		await page.locator("#lang-select").selectOption("es");
		await expect(count).toHaveText("1 comentario");
		fail = true;
		await page.locator("#lang-select").selectOption("fr");
		await expect(page.locator("#lang-select")).toHaveValue("en");
		await expect(count).toHaveText("1 comment");
		await expect(page.locator('[data-i18n="nav_home"]')).toHaveText("Home");
	});
});

test("dictionary cascade translates individual messages, head, and clones, then restores source", async ({
	page,
}) => {
	const requests = [];
	await page.route("**/locales/*.json", async (route) => {
		const pathname = new URL(route.request().url()).pathname;
		requests.push(pathname);
		const dictionaries = {
			"/locales/fr-CA.json": { title: "Allô" },
			"/locales/fr.json": { help: "Aide", cloned: "Copie" },
		};
		await route.fulfill({ json: dictionaries[pathname] });
	});
	const result = await page.evaluate(async () => {
		const { the, $ } = await import("/src/core/index.js");
		document.documentElement.lang = "en";
		document.head.innerHTML =
			'<meta name="i18n" content="/locales" data-available="fr-CA,fr"><title data-i18n="title">Welcome</title>';
		document.body.innerHTML =
			'<h1 data-i18n="title">Welcome</h1><p data-i18n="help">Help</p><p data-i18n="source">Source</p><div id="mount"></div><template id="sample"><p data-i18n="cloned">Copy</p></template>';
		await the.boot({ locale: "fr-CA", persistKeys: [] });
		const clone = $.clone("#mount", "#sample");
		const translated = {
			locale: the.locale,
			title: document.title,
			help: document.querySelector('[data-i18n="help"]').textContent,
			helpLanguage: document.querySelector('[data-i18n="help"]').lang,
			sourceEnglish: document
				.querySelector('[data-i18n="source"]')
				.matches(":lang(en)"),
			clone: clone.textContent,
			cloneLanguage: clone.lang,
		};
		await the.boot({ locale: "en" });
		return {
			translated,
			restored: {
				title: document.title,
				help: document.querySelector('[data-i18n="help"]').textContent,
				clone: clone.textContent,
				cloneEnglish: clone.matches(":lang(en)"),
			},
		};
	});
	expect(requests).toEqual(["/locales/fr-CA.json", "/locales/fr.json"]);
	expect(result).toEqual({
		translated: {
			locale: "fr-CA",
			title: "Allô",
			help: "Aide",
			helpLanguage: "fr",
			sourceEnglish: true,
			clone: "Copie",
			cloneLanguage: "fr",
		},
		restored: {
			title: "Welcome",
			help: "Help",
			clone: "Copy",
			cloneEnglish: true,
		},
	});
});

test("partial Serbian translations preserve English fallback grammar and language", async ({
	page,
}) => {
	await page.route("**/locales/*.json", async (route) => {
		const dictionaries = {
			"/locales/sr-Latn.json": { title: "Dobro došli" },
			"/locales/en.json": {
				count: { one: "{qty} item", other: "{qty} items" },
			},
		};
		await route.fulfill({
			json: dictionaries[new URL(route.request().url()).pathname],
		});
	});
	const result = await page.evaluate(async () => {
		const { the } = await import("/src/core/index.js");
		document.documentElement.lang = "de";
		document.head.innerHTML =
			'<meta name="i18n" content="/locales" data-available="sr-Latn,en" data-fallback="en">';
		document.body.innerHTML =
			'<h1 data-i18n="title">Willkommen</h1><p data-i18n="count" data-i18n-qty="21">21 Einträge</p><p data-i18n="source">Quelle</p>';
		await the.boot({ locale: "sr-Latn-RS", persistKeys: [] });
		return {
			locale: the.locale,
			title: document.querySelector("h1").textContent,
			serbian: document.querySelector("h1").matches(":lang(sr-Latn)"),
			count: document.querySelector('[data-i18n="count"]').textContent,
			english: document
				.querySelector('[data-i18n="count"]')
				.matches(":lang(en)"),
			german: document
				.querySelector('[data-i18n="source"]')
				.matches(":lang(de)"),
		};
	});
	expect(result).toEqual({
		locale: "sr-Latn-RS",
		title: "Dobro došli",
		serbian: true,
		count: "21 items",
		english: true,
		german: true,
	});
});

test("failed translations fall back to a declared non-English source without fetching source JSON", async ({
	page,
}) => {
	const requests = [];
	await page.route("**/locales/*.json", async (route) => {
		requests.push(new URL(route.request().url()).pathname);
		await route.fulfill({ status: 503, body: "Unavailable" });
	});
	const result = await page.evaluate(async () => {
		const { the } = await import("/src/core/index.js");
		document.documentElement.lang = "de";
		document.head.innerHTML =
			'<meta name="i18n" content="/locales" data-available="fr">';
		document.body.innerHTML = '<h1 data-i18n="title">Willkommen</h1>';
		await the.boot({ locale: "fr", persistKeys: [] });
		return {
			locale: the.locale,
			title: document.querySelector("h1").textContent,
			german: document.querySelector("h1").matches(":lang(de)"),
		};
	});
	expect(requests).toEqual(["/locales/fr.json"]);
	expect(result).toEqual({ locale: "de", title: "Willkommen", german: true });
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

test("explicit boot locale preserves the server-rendered document", async ({
	page,
}) => {
	await page.goto(`${origin}/?lang=es`);
	const result = await page.evaluate(async () => {
		const { the } = await import("/src/core/index.js");
		document.documentElement.lang = "en";
		document.body.innerHTML = '<h1 data-i18n="account">Account</h1>';
		localStorage.setItem("otm:lang", "es");
		let fetched = false;
		globalThis.fetch = async () => {
			fetched = true;
			return new Response(JSON.stringify({ account: "Cuenta" }));
		};

		await the.boot({ locale: "en", locales: "/locales" });

		return {
			locale: the.locale,
			text: document.querySelector("h1").textContent,
			fetched,
		};
	});
	expect(result).toEqual({ locale: "en", text: "Account", fetched: false });
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

for (const locale of [undefined, "en"]) {
	test(`boot and state projection work with storage denied and no persistence (locale=${locale})`, async ({
		page,
	}) => {
		const result = await page.evaluate(async (locale) => {
			const { the } = await import("/src/core/index.js");
			document.documentElement.lang = "en";
			document.body.innerHTML = '<output data-text="status">Ready</output>';
			Object.defineProperty(window, "localStorage", {
				configurable: true,
				get() {
					throw new DOMException("Storage disabled", "SecurityError");
				},
			});
			await the.boot({ locale, persistKeys: [] });
			the("status", "Running");
			return {
				locale: the.locale,
				text: document.querySelector("output").textContent,
			};
		}, locale);
		expect(result).toEqual({ locale: "en", text: "Running" });
	});
}
