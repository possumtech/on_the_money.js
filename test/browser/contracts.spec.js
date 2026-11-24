import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import contentExample from "../content-example.js";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const content = contentExample(
	await fs.readFile(path.join(root, "README.md"), "utf8"),
);
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

test.describe("README native document content", () => {
	test("literal bodies remain exact and only replace their outlet", async ({
		page,
	}) => {
		const bodies = [
			"</pre><script>globalThis.contentExecuted = true</script><pre>",
			'<img src=x onerror="globalThis.contentExecuted = true"> &amp; &#x1F600;',
			"# Heading\n**literal Markdown**\r\nСрпски — 日本語 — 😀 e\u0301",
			"Large document <&>\n".repeat(10000),
			"",
		];
		const result = await page.evaluate(
			async ({ content, bodies }) => {
				const { $ } = await import("/src/core/index.js");
				document.body.innerHTML = content.html;
				const insert = new Function("$", "body", content.javascript);
				const article = $("#document");
				const heading = $("h2");
				const status = $("[data-text]");
				const outlet = $("#document-body");
				const attributes = (element) =>
					Array.from(element.attributes, ({ name, value }) => [name, value]);
				const before = Array.from(
					document.body.querySelectorAll("*"),
					attributes,
				);
				const texts = bodies.map((body) => {
					insert($, body);
					return {
						text: outlet.textContent,
						elements: outlet.childElementCount,
						nodes: outlet.childNodes.length,
					};
				});
				return {
					texts,
					executed: globalThis.contentExecuted === true,
					outsidePreserved:
						$("#document") === article &&
						$("h2") === heading &&
						$("[data-text]") === status &&
						$("#document-body") === outlet,
					outsideText: [heading.textContent, status.textContent],
					attributesUnchanged:
						JSON.stringify(before) ===
						JSON.stringify(
							Array.from(document.body.querySelectorAll("*"), attributes),
						),
					bodyAttributes: attributes(document.body),
				};
			},
			{ content, bodies },
		);
		expect(result).toEqual({
			texts: bodies.map((text) => ({ text, elements: 0, nodes: text ? 1 : 0 })),
			executed: false,
			outsidePreserved: true,
			outsideText: ["Document", "Ready"],
			attributesUnchanged: true,
			bodyAttributes: [],
		});
	});

	test("unchanged bodies preserve split text nodes and native partial selection", async ({
		page,
	}) => {
		const result = await page.evaluate(async (content) => {
			const { $ } = await import("/src/core/index.js");
			document.body.innerHTML = content.html;
			const insert = new Function("$", "body", content.javascript);
			const body = "Literal document body";
			insert($, body);
			const outlet = $("#document-body");
			const first = outlet.firstChild;
			const last = first.splitText(8);
			const range = document.createRange();
			range.setStart(first, 1);
			range.setEnd(last, last.length - 1);
			const selection = getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
			const observer = new MutationObserver(() => {});
			observer.observe(document.body, {
				attributes: true,
				childList: true,
				characterData: true,
				subtree: true,
			});
			insert($, body);
			const result = {
				text: outlet.textContent,
				selection: selection.toString(),
				nodesPreserved:
					outlet.firstChild === first && outlet.lastChild === last,
				endpointsPreserved:
					selection.anchorNode === first &&
					selection.anchorOffset === 1 &&
					selection.focusNode === last &&
					selection.focusOffset === last.length - 1,
				mutations: observer.takeRecords().length,
			};
			observer.disconnect();
			return result;
		}, content);
		expect(result).toEqual({
			text: "Literal document body",
			selection: "iteral document bod",
			nodesPreserved: true,
			endpointsPreserved: true,
			mutations: 0,
		});
	});

	test("document content coexists with localization and UI state", async ({
		page,
	}) => {
		const result = await page.evaluate(async (content) => {
			const { $, the } = await import("/src/core/index.js");
			document.documentElement.lang = "en";
			document.body.innerHTML = content.html;
			await the.boot({ locale: "en", persistKeys: [] });
			const insert = new Function("$", "body", content.javascript);
			insert($, "Document body — not interface copy");
			const outlet = $("#document-body");
			const node = outlet.firstChild;
			const records = [];
			const observer = new MutationObserver((mutations) =>
				records.push(...mutations),
			);
			observer.observe(outlet, {
				attributes: true,
				childList: true,
				characterData: true,
				subtree: true,
			});
			await the.boot({
				locale: "sr",
				dictionary: { document_title: "Документ" },
				persistKeys: [],
			});
			the("document-status", "Updated");
			const translated = [
				$("h2").textContent,
				$("h2").lang,
				$("[data-text]").textContent,
			];
			await the.boot({ locale: "en", persistKeys: [] });
			await Promise.resolve();
			records.push(...observer.takeRecords());
			observer.disconnect();
			return {
				translated,
				restored: [$("h2").textContent, $("h2").lang],
				text: outlet.textContent,
				nodePreserved: outlet.firstChild === node,
				attributes: outlet.getAttributeNames(),
				stateKeys: document.body.getAttributeNames(),
				mutations: records.length,
			};
		}, content);
		expect(result).toEqual({
			translated: ["Документ", "sr", "Updated"],
			restored: ["Document", ""],
			text: "Document body — not interface copy",
			nodePreserved: true,
			attributes: ["id"],
			stateKeys: ["data-document-status"],
			mutations: 0,
		});
	});
});

test.describe("idempotent projection", () => {
	for (const scope of ["global", "scoped", "self"]) {
		test(`unchanged text retains native partial selection and nodes (${scope})`, async ({
			page,
		}) => {
			const results = await page.evaluate(async (scope) => {
				const { the, $ } = await import("/src/core/index.js");
				document.documentElement.lang = "en";
				document.body.innerHTML = `
					<main id="rows"></main>
					<template id="message"><article>
						<strong data-text="label" data-bind="title:label">Message</strong>
						<pre><code data-text="arguments" data-bind="title:arguments">Arguments</code></pre>
					</article></template>`;
				await the.boot({ locale: "en", persistKeys: [] });
				const row = $.clone("#rows", "#message");
				return [
					["label", "Assistant"],
					["arguments", '{"path":"README.md"}'],
				].map(([key, value]) => {
					const target = row.querySelector(`[data-text="${key}"]`);
					const write = () =>
						scope === "global"
							? the({ [key]: value })
							: the(scope === "self" ? target : row, { [key]: value });
					write();
					const first = target.firstChild;
					const last = first.splitText(Math.floor(value.length / 2));
					const range = document.createRange();
					range.setStart(first, 1);
					range.setEnd(last, last.length - 1);
					const selection = getSelection();
					selection.removeAllRanges();
					selection.addRange(range);
					const before = selection.toString();
					const observer = new MutationObserver(() => {});
					observer.observe(document.documentElement, {
						attributes: true,
						childList: true,
						characterData: true,
						subtree: true,
					});
					write();
					const mutations = observer.takeRecords().map(({ type }) => type);
					observer.disconnect();
					return {
						key,
						before,
						after: selection.toString(),
						nodesPreserved:
							target.firstChild === first && target.lastChild === last,
						endpointsPreserved:
							selection.anchorNode === first &&
							selection.anchorOffset === 1 &&
							selection.focusNode === last &&
							selection.focusOffset === last.length - 1,
						mutations,
					};
				});
			}, scope);
			expect(results).toEqual([
				{
					key: "label",
					before: "ssistan",
					after: "ssistan",
					nodesPreserved: true,
					endpointsPreserved: true,
					mutations: [],
				},
				{
					key: "arguments",
					before: '"path":"README.md"',
					after: '"path":"README.md"',
					nodesPreserved: true,
					endpointsPreserved: true,
					mutations: [],
				},
			]);
		});
	}

	test("attributes notify only on changes while new bindings hydrate and deletions repair drift", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { the } = await import("/src/core/index.js");
			const callbacks = [];
			customElements.define(
				"projection-probe",
				class extends HTMLElement {
					static observedAttributes = ["data-label", "title", "aria-expanded"];
					attributeChangedCallback(name, oldValue, value) {
						callbacks.push([name, oldValue, value]);
					}
				},
			);
			document.body.innerHTML =
				'<projection-probe data-bind="title:label"><span data-text="label">Source</span></projection-probe>';
			const owner = document.querySelector("projection-probe");
			the(owner, { label: "Assistant", expanded: true });
			const initialCallbacks = callbacks
				.splice(0)
				.map(([name]) => name)
				.sort();
			const observer = new MutationObserver(() => {});
			observer.observe(owner, {
				attributes: true,
				childList: true,
				subtree: true,
			});
			the(owner, { label: "Assistant", expanded: true });
			const unchanged = {
				records: observer.takeRecords().length,
				callbacks: callbacks.splice(0),
			};
			const fresh = document.createElement("a");
			fresh.setAttribute("data-bind", "title:label");
			fresh.setAttribute("data-text", "label");
			owner.append(fresh);
			observer.takeRecords();
			the(owner, "label", "Assistant");
			const inserted = [fresh.textContent, fresh.getAttribute("title")];
			fresh.textContent = "Drift";
			fresh.setAttribute("title", "Drift");
			the(owner, "label", "Assistant");
			const repaired = [fresh.textContent, fresh.getAttribute("title")];
			observer.takeRecords();
			the(owner, { label: "User", expanded: false });
			const changed = {
				text: fresh.textContent,
				title: fresh.getAttribute("title"),
				expanded: owner.getAttribute("aria-expanded"),
				callbacks: callbacks.splice(0),
				records: observer
					.takeRecords()
					.map(({ type, attributeName }) => [type, attributeName]),
			};
			the(owner, { label: null, expanded: null });
			const removed = [
				the(owner, "label"),
				owner.getAttribute("title"),
				fresh.getAttribute("title"),
				fresh.textContent,
				owner.getAttribute("aria-expanded"),
			];
			callbacks.splice(0);
			observer.takeRecords();
			the(owner, { label: null, expanded: null });
			const repeatedDelete = {
				records: observer.takeRecords().length,
				callbacks: callbacks.splice(0),
			};
			fresh.textContent = "Late source";
			fresh.setAttribute("title", "Late source");
			the(owner, "label", null);
			const repairedDelete = [fresh.textContent, fresh.getAttribute("title")];
			the(owner, "label", "");
			const empty = [
				the(owner, "label"),
				owner.getAttribute("title"),
				fresh.getAttribute("title"),
			];
			observer.disconnect();
			return {
				initialCallbacks,
				unchanged,
				inserted,
				repaired,
				changed,
				removed,
				repeatedDelete,
				repairedDelete,
				empty,
			};
		});
		expect(result.initialCallbacks).toEqual([
			"aria-expanded",
			"data-label",
			"title",
		]);
		expect(result.unchanged).toEqual({ records: 0, callbacks: [] });
		expect(result.inserted).toEqual(["Assistant", "Assistant"]);
		expect(result.repaired).toEqual(["Assistant", "Assistant"]);
		expect(result.changed).toEqual({
			text: "User",
			title: "User",
			expanded: "false",
			callbacks: [
				["data-label", "Assistant", "User"],
				["title", "Assistant", "User"],
				["aria-expanded", "true", "false"],
			],
			records: [
				["attributes", "data-label"],
				["childList", null],
				["childList", null],
				["attributes", "title"],
				["attributes", "title"],
				["attributes", "aria-expanded"],
			],
		});
		expect(result.removed).toEqual([null, null, null, "", null]);
		expect(result.repeatedDelete).toEqual({ records: 0, callbacks: [] });
		expect(result.repairedDelete).toEqual(["", null]);
		expect(result.empty).toEqual(["", "", ""]);
	});

	test("localization preserves selection across equal text, language changes, and source restoration", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { the, _t } = await import("/src/core/index.js");
			document.documentElement.lang = "en";
			document.body.innerHTML =
				'<strong data-i18n="label" lang="en-GB">Assistant</strong>';
			const target = document.querySelector("strong");
			const node = target.firstChild;
			const selection = getSelection();
			const range = document.createRange();
			range.setStart(node, 1);
			range.setEnd(node, 8);
			selection.removeAllRanges();
			selection.addRange(range);
			const states = [];
			const snapshot = () =>
				states.push({
					text: target.textContent,
					selected: selection.toString(),
					sameNode: target.firstChild === node,
					lang: target.lang,
				});
			await the.boot({
				locale: "fr",
				defaultLocale: "en",
				dictionary: { label: "Assistant" },
				persistKeys: [],
			});
			snapshot();
			const delivered = [];
			const observer = new MutationObserver((records) =>
				delivered.push(...records),
			);
			const takeMutations = () => {
				delivered.push(...observer.takeRecords());
				return delivered.splice(0).map(({ type }) => type);
			};
			observer.observe(document.documentElement, {
				attributes: true,
				childList: true,
				characterData: true,
				subtree: true,
			});
			_t(target);
			_t();
			await the.boot({
				locale: "fr",
				defaultLocale: "en",
				dictionary: { label: "Assistant" },
				persistKeys: [],
			});
			const unchanged = takeMutations();
			snapshot();
			await the.boot({
				locale: "de",
				dictionary: { label: "Assistant" },
				persistKeys: [],
			});
			snapshot();
			the.dictionary = {};
			_t();
			snapshot();
			takeMutations();
			_t();
			const repeatedRestore = takeMutations();
			snapshot();
			the.dictionary = { label: "Changed" };
			_t();
			const changed = [target.textContent, target.lang];
			the.dictionary = {};
			_t();
			const restored = [target.textContent, target.lang];
			observer.disconnect();
			return { states, unchanged, repeatedRestore, changed, restored };
		});
		expect(result.states).toEqual(
			["fr", "fr", "de", "en-GB", "en-GB"].map((lang) => ({
				text: "Assistant",
				selected: "ssistan",
				sameNode: true,
				lang,
			})),
		);
		expect(result.unchanged).toEqual([]);
		expect(result.repeatedRestore).toEqual([]);
		expect(result.changed).toEqual(["Changed", "de"]);
		expect(result.restored).toEqual(["Assistant", "en-GB"]);
	});
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

		const sharedEvents = [];
		const ac = new AbortController();
		const offFirst = on.target(window, "otm-shared", () =>
			sharedEvents.push("first"),
		);
		on.target(window, "otm-shared", () => sharedEvents.push("second"), {
			signal: ac.signal,
		});
		window.dispatchEvent(new Event("otm-shared"));
		ac.abort();
		window.dispatchEvent(new Event("otm-shared"));
		offFirst();
		window.dispatchEvent(new Event("otm-shared"));
		let rejectedElement = false;
		try {
			on.target(document.body, "click", () => {});
		} catch (error) {
			rejectedElement = error instanceof TypeError;
		}
		return {
			clicks,
			text: button.textContent,
			connected: button.isConnected,
			sharedEvents,
			rejectedElement,
		};
	});
	expect(result).toEqual({
		clicks: 1,
		text: "Choose",
		connected: true,
		sharedEvents: ["first", "second", "first"],
		rejectedElement: true,
	});
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

test("router navigation, initial: false, replaceState, single-fire hash jump, and unsubscribe", async ({
	page,
}) => {
	const result = await page.evaluate(async () => {
		const { route } = await import("/src/core/index.js");
		document.body.innerHTML =
			'<a id="frag" href="#details">Details</a><section id="details"></section>';
		const visits = [];
		const off = route(
			(pathname, _search, hash) => visits.push(`${pathname}${hash}`),
			{ initial: false },
		);
		const initialLength = window.history.length;
		route.go("/next");
		const afterPushLength = window.history.length;
		route.go("/settled", { replace: true });
		const afterReplaceLength = window.history.length;
		route.go("/settled");
		document.getElementById("frag").click();
		await new Promise((r) => setTimeout(r, 20));
		off();
		window.history.pushState({}, "", "/after");
		window.dispatchEvent(new PopStateEvent("popstate"));
		return {
			visits,
			pushedIncrement: afterPushLength - initialLength,
			replacedDelta: afterReplaceLength - afterPushLength,
			pathname: window.location.pathname,
		};
	});
	expect(result).toEqual({
		visits: ["/next", "/settled", "/settled#details"],
		pushedIncrement: 1,
		replacedDelta: 0,
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

test("header-authenticated sse streams named events and forwards authorization in real browsers", async ({
	page,
}) => {
	const seenHeaders = [];
	await page.route("**/__otm_sse", async (route) => {
		seenHeaders.push(route.request().headers().authorization ?? null);
		await route.fulfill({
			status: 200,
			headers: { "content-type": "text/event-stream; charset=utf-8" },
			body: 'id: 9\nevent: update\ndata: {"ok":true}\n\n',
		});
	});
	const result = await page.evaluate(async () => {
		const { sse } = await import("/src/live/index.js");
		return await new Promise((resolve) => {
			const ch = sse("/__otm_sse", {
				types: ["update"],
				headers: () => ({ authorization: "Bearer browser-token" }),
				onMessage(type, data, lastEventId) {
					ch.close();
					resolve({ type, data, lastEventId });
				},
			});
		});
	});
	expect(seenHeaders).toEqual(["Bearer browser-token"]);
	expect(result).toEqual({
		type: "update",
		data: { ok: true },
		lastEventId: "9",
	});
});

test("5-S CSS substrate (schema + scheme + @layer) responds to the('theme'), scoped theme, and ARIA states in real browsers", async ({
	page,
}) => {
	await page.addStyleTag({ url: "/src/css/schema.css" });
	await page.addStyleTag({ url: "/src/css/schemes/jade.css" });
	await page.addStyleTag({
		content: `
			@layer structure { main > section { display: none; } }
			@layer style { :root { --otm-heading-color: light-dark(rgb(170, 0, 85), rgb(255, 102, 178)); } }
			@layer state { body[data-panel="open"] main > section[data-panel] { display: block; } }
		`,
	});
	const result = await page.evaluate(async () => {
		const { the } = await import("/src/core/index.js");
		document.body.innerHTML = `
			<main>
				<section data-panel>
					<h1 id="brand-heading">Brand</h1>
					<a id="link" href="#top">Link</a>
					<p>Inline <code id="inline-code">very-long-identifier</code> and <kbd id="key">Ctrl</kbd></p>
					<pre><code id="block-code">const x = 1;</code></pre>
					<input id="email" type="email" aria-invalid="true">
					<button id="go" aria-busy="true">Go</button>
					<button id="icon-btn" aria-label="Sign out"><svg id="decorative-icon" aria-hidden="true" width="16" height="16"></svg></button>
					<div id="native-hidden" hidden>Hidden</div>
					<aside id="scoped-dark" data-theme="dark">
						<h2 id="scoped-dark-heading">Dark heading</h2>
						<p id="scoped-dark-text">Dark copy</p>
						<article id="scoped-dark-card">Card</article>
						<a id="scoped-dark-link" href="#x">Dark</a>
					</aside>
					<aside id="scoped-light" data-theme="light">
						<p id="scoped-light-text">Light copy</p>
					</aside>
				</section>
			</main>
		`;
		the("theme", "light");
		const lightBg = getComputedStyle(document.body).backgroundColor;
		const lightHeading = getComputedStyle(
			document.querySelector("#brand-heading"),
		).color;
		const jadeLightLink = getComputedStyle(
			document.querySelector("#link"),
		).color;
		const jadeLightUnderline = getComputedStyle(
			document.querySelector("#link"),
		).textDecorationColor;
		const scopedDarkBg = getComputedStyle(
			document.querySelector("#scoped-dark"),
		).backgroundColor;
		const scopedDarkHeading = getComputedStyle(
			document.querySelector("#scoped-dark-heading"),
		).color;
		const scopedDarkText = getComputedStyle(
			document.querySelector("#scoped-dark-text"),
		).color;
		const scopedDarkCardBg = getComputedStyle(
			document.querySelector("#scoped-dark-card"),
		).backgroundColor;
		const scopedDarkLink = getComputedStyle(
			document.querySelector("#scoped-dark-link"),
		).color;
		const scopedDarkUnderline = getComputedStyle(
			document.querySelector("#scoped-dark-link"),
		).textDecorationColor;
		const hiddenDisplay = getComputedStyle(
			document.querySelector("section[data-panel]"),
		).display;

		the("theme", "dark");
		const darkBg = getComputedStyle(document.body).backgroundColor;
		const darkHeading = getComputedStyle(
			document.querySelector("#brand-heading"),
		).color;
		const jadeDarkLink = getComputedStyle(
			document.querySelector("#link"),
		).color;
		const scopedLightBg = getComputedStyle(
			document.querySelector("#scoped-light"),
		).backgroundColor;
		const scopedLightText = getComputedStyle(
			document.querySelector("#scoped-light-text"),
		).color;

		the("panel", "open");
		const openDisplay = getComputedStyle(
			document.querySelector("section[data-panel]"),
		).display;

		const invalidBorder = getComputedStyle(
			document.querySelector("#email"),
		).borderTopColor;
		const busyCursor = getComputedStyle(document.querySelector("#go")).cursor;
		const decorativeIconDisplay = getComputedStyle(
			document.querySelector("#decorative-icon"),
		).display;
		const nativeHiddenDisplay = getComputedStyle(
			document.querySelector("#native-hidden"),
		).display;
		const inlineCodeDisplay = getComputedStyle(
			document.querySelector("#inline-code"),
		).display;
		const kbdDisplay = getComputedStyle(document.querySelector("#key")).display;
		const blockCodeDisplay = getComputedStyle(
			document.querySelector("#block-code"),
		).display;

		return {
			lightBg,
			darkBg,
			lightHeading,
			darkHeading,
			scopedDarkHeading,
			jadeLightLink,
			jadeLightUnderline,
			scopedDarkBg,
			scopedDarkText,
			scopedDarkCardBg,
			scopedDarkLink,
			scopedDarkUnderline,
			scopedLightBg,
			scopedLightText,
			jadeDarkLink,
			hiddenDisplay,
			openDisplay,
			invalidBorder,
			busyCursor,
			decorativeIconDisplay,
			nativeHiddenDisplay,
			inlineCodeDisplay,
			kbdDisplay,
			blockCodeDisplay,
		};
	});

	expect(result.lightBg).toBe("rgb(255, 255, 255)");
	expect(result.darkBg).toBe("rgb(19, 23, 31)");
	expect(result.lightHeading).toBe("rgb(170, 0, 85)");
	expect(result.darkHeading).toBe("rgb(255, 102, 178)");
	expect(result.scopedDarkHeading).toBe("rgb(255, 102, 178)");
	expect(result.jadeLightLink).toBe("rgb(0, 122, 80)");
	expect(result.scopedDarkBg).toBe("rgb(19, 23, 31)");
	expect(result.scopedDarkText).toBe("rgb(194, 199, 208)");
	expect(result.scopedDarkCardBg).toBe("rgb(24, 28, 37)");
	expect(result.scopedDarkLink).toBe("rgb(0, 180, 120)");
	expect(result.scopedDarkUnderline).not.toBe(result.jadeLightUnderline);
	expect(result.scopedLightBg).toBe("rgb(255, 255, 255)");
	expect(result.scopedLightText).toBe("rgb(55, 60, 68)");
	expect(result.jadeDarkLink).toBe("rgb(0, 180, 120)");
	expect(result.hiddenDisplay).toBe("none");
	expect(result.openDisplay).toBe("block");
	expect(result.invalidBorder).toBe("rgb(224, 112, 112)");
	expect(result.busyCursor).toBe("progress");
	expect(result.decorativeIconDisplay).not.toBe("none");
	expect(result.nativeHiddenDisplay).toBe("none");
	expect(result.inlineCodeDisplay).toBe("inline");
	expect(result.kbdDisplay).toBe("inline-block");
	expect(result.blockCodeDisplay).toBe("block");
});

test("$.reconcile preserves DOM identity, active focus, textarea draft, and open <details> across updates and reorderings", async ({
	page,
}) => {
	const result = await page.evaluate(async () => {
		const { $, the } = await import("/src/core/index.js");
		document.body.innerHTML = `
			<ul id="turns"></ul>
			<template id="turn-card">
				<li data-item>
					<strong data-text="title"></strong>
					<textarea></textarea>
					<details><summary>Notes</summary><p>Detail</p></details>
				</li>
			</template>
		`;
		const fill = (el, item) => the(el, { title: item.title });
		const [first, second] = $.reconcile(
			"#turns",
			"#turn-card",
			[
				{ id: "t1", title: "First" },
				{ id: "t2", title: "Second" },
			],
			{ key: (x) => x.id, fill },
		);

		const details = second.querySelector("details");
		const textarea = second.querySelector("textarea");
		details.open = true;
		textarea.value = "Draft reply";
		textarea.focus();

		// 1. Update in place + append: neither existing row moves, focus stays in every engine
		$.reconcile(
			"#turns",
			"#turn-card",
			[
				{ id: "t1", title: "First (v2)" },
				{ id: "t2", title: "Second (v2)" },
				{ id: "t3", title: "Third" },
			],
			{ key: (x) => x.id, fill },
		);
		const focusAfterInPlaceUpdate = document.activeElement === textarea;

		// 2. Prepend + reorder (moves t2 ahead of t1) + remove t3
		const after = $.reconcile(
			"#turns",
			"#turn-card",
			[
				{ id: "t0", title: "Prepended" },
				{ id: "t2", title: "Second (v3)" },
				{ id: "t1", title: "First (v3)" },
			],
			{ key: (x) => x.id, fill },
		);

		return {
			count: after.length,
			sameFirst: after[2] === first,
			sameSecond: after[1] === second,
			order: after.map((el) => el.getAttribute("data-otm-key")),
			titles: after.map((el) => el.querySelector("strong").textContent),
			detailsStillOpen: details.open,
			draftPreserved: textarea.value,
			focusAfterInPlaceUpdate,
			focusAfterReorder: document.activeElement === textarea,
		};
	});

	expect(result).toEqual({
		count: 3,
		sameFirst: true,
		sameSecond: true,
		order: ["t0", "t2", "t1"],
		titles: ["Prepended", "Second (v3)", "First (v3)"],
		detailsStillOpen: true,
		draftPreserved: "Draft reply",
		focusAfterInPlaceUpdate: true,
		focusAfterReorder: true,
	});
});

test("scoped writes respect nested [data-otm-scope] boundaries while global writes remain document-wide", async ({
	page,
}) => {
	const result = await page.evaluate(async () => {
		const { $, the } = await import("/src/core/index.js");
		document.body.innerHTML = `
			<div id="workspaces"></div>
			<template id="workspace-card">
				<article data-otm-scope>
					<a class="ws-name" data-text="name" data-bind="href:url"></a>
					<span class="ws-banner" data-text="banner"></span>
					<ul class="sessions"></ul>
				</article>
			</template>
			<template id="session-row">
				<li data-otm-scope>
					<a class="session-name" data-text="name" data-bind="href:url"></a>
					<a class="parent-ref" data-otm-scope data-text="name" data-bind="href:url"></a>
					<span class="session-banner" data-text="banner"></span>
				</li>
			</template>
		`;
		const [card] = $.reconcile(
			"#workspaces",
			"#workspace-card",
			[{ id: "w1", name: "Core", url: "/w/1" }],
			{
				key: (w) => w.id,
				fill: (el, w) => the(el, { name: w.name, url: w.url }),
			},
		);
		const [row] = $.reconcile(
			card.querySelector(".sessions"),
			"#session-row",
			[{ id: "s1", name: "Session 1", url: "/s/1" }],
			{
				key: (s) => s.id,
				fill: (el, s) => {
					the(el, { name: s.name, url: s.url });
					the(el.querySelector(".parent-ref"), {
						name: "Parent 0",
						url: "/s/0",
					});
				},
			},
		);

		// Re-write parent card after nested items exist, then delete parent url:
		the(card, { name: "Core Updated", url: "/w/1-next" });
		the(card, "url", null);
		// Global write reaches through [data-otm-scope] into both outer and inner slots:
		the("banner", "Synced");

		return {
			wsName: card.querySelector(".ws-name").textContent,
			wsHref: card.querySelector(".ws-name").getAttribute("href"),
			sessionName: row.querySelector(".session-name").textContent,
			sessionHref: row.querySelector(".session-name").getAttribute("href"),
			parentName: row.querySelector(".parent-ref").textContent,
			parentHref: row.querySelector(".parent-ref").getAttribute("href"),
			wsBanner: card.querySelector(".ws-banner").textContent,
			sessionBanner: row.querySelector(".session-banner").textContent,
		};
	});

	expect(result).toEqual({
		wsName: "Core Updated",
		wsHref: null,
		sessionName: "Session 1",
		sessionHref: "/s/1",
		parentName: "Parent 0",
		parentHref: "/s/0",
		wsBanner: "Synced",
		sessionBanner: "Synced",
	});
});

test("on_the_money/combobox honors WAI-ARIA APG keyboard, focus preservation, dialog Escape, $.reconcile sync, and popover=manual in real browsers", async ({
	page,
}) => {
	await page.evaluate(async () => {
		const { $, on, the } = await import("/src/core/index.js");
		const { combobox } = await import("/src/combobox/index.js");

		document.body.innerHTML = `
			<dialog id="picker-dialog">
				<button id="before-btn" type="button">Before</button>
				<input
					id="combo-input"
					type="text"
					role="combobox"
					aria-controls="combo-list"
					aria-expanded="false"
					aria-autocomplete="list"
					value="cl"
				>
				<ul id="combo-list" role="listbox" aria-label="Models" popover="manual"></ul>
			</dialog>
			<template id="combo-opt">
				<li role="option"><strong data-text="name"></strong></li>
			</template>
		`;

		const dialog = document.getElementById("picker-dialog");
		const input = document.getElementById("combo-input");
		const listbox = document.getElementById("combo-list");

		const render = (items) =>
			$.reconcile(listbox, "#combo-opt", items, {
				key: (item) => item.id,
				fill: (el, item) => {
					the(el, { name: item.name });
					if (item.disabled) el.setAttribute("aria-disabled", "true");
					else el.removeAttribute("aria-disabled");
				},
			});

		render([
			{ id: "m1", name: "Claude" },
			{ id: "m2", name: "Disabled", disabled: true },
			{ id: "m3", name: "Gemini" },
		]);

		const selected = [];
		const ac = new AbortController();
		const ctrl = combobox(input, {
			signal: ac.signal,
			onSelect(option, el) {
				selected.push(option.getAttribute("data-otm-key"));
				el.value = option.querySelector("strong").textContent;
			},
		});

		let inputEvents = 0;
		const offInput = on(input, "input", '[role="combobox"]', () => {
			inputEvents += 1;
		});

		dialog.showModal();
		globalThis.__comboState = {
			dialog,
			input,
			listbox,
			ctrl,
			render,
			selected,
			getInputEvents: () => inputEvents,
			cleanup: () => {
				offInput();
				ac.abort();
				dialog.close();
			},
		};
	});

	// Focus moves from #before-btn onto #combo-input -> opens listbox in Top Layer
	await page.locator("#combo-input").focus();
	const openedOnFocus = await page.evaluate(() => {
		const { input, listbox, ctrl } = globalThis.__comboState;
		input.setSelectionRange(2, 2);
		return (
			ctrl.expanded &&
			input.getAttribute("aria-expanded") === "true" &&
			listbox.matches(":popover-open")
		);
	});
	expect(openedOnFocus).toBe(true);

	// Real ArrowDown -> m1, ArrowDown -> skips disabled m2 -> m3, focus stays on input
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("ArrowDown");
	const afterArrows = await page.evaluate(() => {
		const { input, ctrl } = globalThis.__comboState;
		return {
			hasActiveId: Boolean(input.getAttribute("aria-activedescendant")),
			activeKey: ctrl.activeOption?.getAttribute("data-otm-key"),
			activeAttr: ctrl.activeOption?.getAttribute("data-active"),
			focusStayedOnInput: document.activeElement === input,
		};
	});
	expect(afterArrows).toEqual({
		hasActiveId: true,
		activeKey: "m3",
		activeAttr: "true",
		focusStayedOnInput: true,
	});

	// Real Home in editable <input> clears activedescendant without hijacking native caret
	await page.keyboard.press("Home");
	const afterHome = await page.evaluate(() => {
		const { input, ctrl } = globalThis.__comboState;
		return {
			activeOption: ctrl.activeOption,
			activedescendant: input.getAttribute("aria-activedescendant"),
			caretAtStart: input.selectionStart === 0,
		};
	});
	expect(afterHome).toEqual({
		activeOption: null,
		activedescendant: null,
		caretAtStart: true,
	});

	// ArrowDown to m1, then replace options via $.reconcile removing m1 + sync()
	await page.keyboard.press("ArrowDown");
	const clearedAfterSync = await page.evaluate(() => {
		const { input, ctrl, render } = globalThis.__comboState;
		render([
			{ id: "m4", name: "OpenAI" },
			{ id: "m5", name: "Mistral" },
		]);
		ctrl.sync();
		return (
			ctrl.activeOption === null &&
			input.getAttribute("aria-activedescendant") === null
		);
	});
	expect(clearedAfterSync).toBe(true);

	// Real trusted Escape closes combobox WITHOUT dismissing the enclosing modal <dialog>
	await page.keyboard.press("Escape");
	const closedKeepingDialog = await page.evaluate(() => {
		const { dialog, listbox, ctrl } = globalThis.__comboState;
		return !ctrl.expanded && !listbox.matches(":popover-open") && dialog.open;
	});
	expect(closedKeepingDialog).toBe(true);

	// Re-open via click and select an option via real mouse click: focus remains on input
	await page.locator("#combo-input").click();
	await page.locator('#combo-list [data-otm-key="m4"]').click();
	const afterClick = await page.evaluate(() => {
		const { input, listbox, ctrl, selected } = globalThis.__comboState;
		const opt = listbox.querySelector('[data-otm-key="m4"]');
		return {
			selected: [...selected],
			value: input.value,
			ariaSelected: opt.getAttribute("aria-selected"),
			expanded: ctrl.expanded,
			focusStillOnInput: document.activeElement === input,
		};
	});
	expect(afterClick).toEqual({
		selected: ["m4"],
		value: "OpenAI",
		ariaSelected: "true",
		expanded: false,
		focusStillOnInput: true,
	});

	// Trusted Escape while closed clears input value and fires input without re-opening or closing <dialog>
	await page.keyboard.press("Escape");
	const afterEscapeClear = await page.evaluate(() => {
		const { dialog, input, ctrl, getInputEvents, cleanup } =
			globalThis.__comboState;
		const snapshot = {
			value: input.value,
			inputEvents: getInputEvents(),
			expanded: ctrl.expanded,
			dialogStillOpen: dialog.open,
		};
		cleanup();
		delete globalThis.__comboState;
		return snapshot;
	});
	expect(afterEscapeClear).toEqual({
		value: "",
		inputEvents: 1,
		expanded: false,
		dialogStillOpen: true,
	});
});
