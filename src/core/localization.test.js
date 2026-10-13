import assert from "node:assert/strict";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import { _t, the } from "./index.js";

const setup = (
	t,
	{ source = "en", available = "", fallback, body, dictionaries = {} } = {},
) => {
	const { document } = setupDOM(body ?? '<h1 data-i18n="title">Welcome</h1>');
	document.documentElement.lang = source;
	if (available) {
		const meta = document.createElement("meta");
		meta.setAttribute("name", "i18n");
		meta.setAttribute("content", "/locales");
		meta.setAttribute("data-available", available);
		if (fallback) meta.setAttribute("data-fallback", fallback);
		document.head.append(meta);
	}
	const urls = [];
	t.mock.method(globalThis, "fetch", async (url) => {
		urls.push(url);
		const value = dictionaries[url];
		if (value instanceof Error) throw value;
		return value === undefined
			? { ok: false, status: 404 }
			: { ok: true, json: async () => value };
	});
	return { document, urls };
};

for (const locale of ["en", "sr-Latn-RS"]) {
	test(`source-only document needs no dictionary (${locale})`, async (t) => {
		const { document, urls } = setup(t);
		await the.boot({ locale, persistKeys: [] });
		assert.equal(document.querySelector("h1").textContent, "Welcome");
		assert.equal(document.documentElement.lang, "en");
		assert.equal(the.locale, "en");
		assert.deepEqual(urls, []);
	});
}

test("dictionary lookup cascades per message and retains regional preference", async (t) => {
	const { document, urls } = setup(t, {
		available: "fr-CA,fr,en",
		body: '<h1 data-i18n="title">Welcome</h1><p data-i18n="help">Help</p><p data-i18n="source">English source</p>',
		dictionaries: {
			"/locales/fr-CA.json": { title: "Allô" },
			"/locales/fr.json": { title: "Bonjour", help: "Aide" },
			"/locales/en.json": { extra: "Extra" },
		},
	});
	await the.boot({ locale: "fr-CA", persistKeys: [] });
	assert.deepEqual(urls, [
		"/locales/fr-CA.json",
		"/locales/fr.json",
		"/locales/en.json",
	]);
	assert.equal(the.locale, "fr-CA");
	assert.deepEqual(
		[...document.querySelectorAll("[data-i18n]")].map((el) => [
			el.textContent,
			el.closest("[lang]").getAttribute("lang"),
		]),
		[
			["Allô", "fr-CA"],
			["Aide", "fr"],
			["English source", "en"],
		],
	);
	assert.equal(_t("help"), "Aide");
	assert.equal(_t("extra"), "Extra");
});

test("an explicitly advertised source catalog supplies changing plural messages", async (t) => {
	const { document, urls } = setup(t, {
		available: "en",
		body: '<p data-i18n="count" data-i18n-qty="0">0 items</p>',
		dictionaries: {
			"/locales/en.json": {
				count: { one: "{qty} item", other: "{qty} items" },
			},
		},
	});
	await the.boot({ locale: "en", persistKeys: [] });
	const count = document.querySelector("p");
	for (const [qty, text] of [
		[1, "1 item"],
		[2, "2 items"],
		[0, "0 items"],
	]) {
		count.setAttribute("data-i18n-qty", qty);
		_t(count);
		assert.equal(count.textContent, text);
		assert.equal(count.lang, "en");
	}
	assert.deepEqual(urls, ["/locales/en.json"]);
});

test("partial translations fall through to an advertised source catalog before static text", async (t) => {
	const { document, urls } = setup(t, {
		available: "fr,en",
		body: '<h1 data-i18n="title">Welcome</h1><p data-i18n="count" data-i18n-qty="0">0 items</p><p data-i18n="source">Source</p>',
		dictionaries: {
			"/locales/fr.json": { title: "Bonjour" },
			"/locales/en.json": {
				count: { one: "{qty} item", other: "{qty} items" },
			},
		},
	});
	await the.boot({ locale: "fr", persistKeys: [] });
	assert.deepEqual(urls, ["/locales/fr.json", "/locales/en.json"]);
	assert.equal(document.querySelector("h1").textContent, "Bonjour");
	assert.equal(document.querySelector("p").textContent, "0 items");
	assert.equal(document.querySelector("p").lang, "en");
	assert.equal(
		document.querySelector('[data-i18n="source"]').textContent,
		"Source",
	);
});

test("a failed advertised source catalog preserves source text with its cause", async (t) => {
	const cause = new Error("Source catalog unavailable");
	const { document, urls } = setup(t, {
		available: "en",
		dictionaries: { "/locales/en.json": cause },
	});
	const warnings = t.mock.method(console, "warn", () => {});
	await the.boot({ locale: "de", persistKeys: [] });
	assert.deepEqual(urls, ["/locales/en.json"]);
	assert.equal(warnings.mock.calls[0].arguments[1], cause);
	assert.equal(document.querySelector("h1").textContent, "Welcome");
	assert.equal(the.locale, "en");
});

test("an undeclared source catalog is never guessed from a bare endpoint", async (t) => {
	const { document, urls } = setup(t);
	await the.boot({ locale: "en", locales: "/locales", persistKeys: [] });
	assert.deepEqual(urls, []);
	assert.equal(document.querySelector("h1").textContent, "Welcome");
});

test("non-English source is the final fallback without an English request", async (t) => {
	const { document, urls } = setup(t, {
		source: "de",
		available: "fr",
		body: '<p data-i18n="title">Willkommen</p>',
	});
	const warnings = t.mock.method(console, "warn", () => {});
	await the.boot({ locale: "fr", persistKeys: [] });
	assert.deepEqual(urls, ["/locales/fr.json"]);
	assert.equal(warnings.mock.calls.length, 1);
	assert.equal(the.locale, "de");
	assert.equal(document.querySelector("p").textContent, "Willkommen");
	assert.equal(document.documentElement.lang, "de");
});

test("source text needs no fetch when the requested language is unsupported", async (t) => {
	const { urls } = setup(t, { available: "fr" });
	await the.boot({ locale: "de", persistKeys: [] });
	assert.deepEqual(urls, []);
	assert.equal(the.locale, "en");
});

test("per-message fallback uses the supplying dictionary's plural rules", async (t) => {
	const { document } = setup(t, {
		source: "de",
		available: "sr-Latn,en",
		fallback: "en",
		body: '<h1 data-i18n="title">Willkommen</h1><p data-i18n="count" data-i18n-qty="21">21 Einträge</p>',
		dictionaries: {
			"/locales/sr-Latn.json": { title: "Dobro došli" },
			"/locales/en.json": {
				count: { one: "{qty} item", other: "{qty} items" },
			},
		},
	});
	await the.boot({ locale: "sr-Latn-RS", persistKeys: [] });
	assert.equal(the.locale, "sr-Latn-RS");
	assert.equal(document.querySelector("h1").textContent, "Dobro došli");
	assert.equal(document.querySelector("p").textContent, "21 items");
	assert.equal(document.querySelector("p").lang, "en");
	assert.equal(_t("count", { qty: 21 }), "21 items");
});

test("a different script does not trigger the source-language short circuit", async (t) => {
	const { document, urls } = setup(t, {
		source: "sr-Cyrl",
		available: "sr-Latn",
		dictionaries: { "/locales/sr-Latn.json": { title: "Dobro došli" } },
	});
	await the.boot({ locale: "sr-Latn-RS", persistKeys: [] });
	assert.deepEqual(urls, ["/locales/sr-Latn.json"]);
	assert.equal(document.querySelector("h1").lang, "sr-Latn");
});

test("an available regional dictionary outranks a same-language source", async (t) => {
	const { document, urls } = setup(t, {
		source: "en-US",
		available: "en-GB",
		dictionaries: { "/locales/en-GB.json": { title: "Colour" } },
	});
	await the.boot({ locale: "en-GB", persistKeys: [] });
	assert.deepEqual(urls, ["/locales/en-GB.json"]);
	assert.equal(document.querySelector("h1").textContent, "Colour");
});

test("language switching restores source instead of retaining stale translations", async (t) => {
	const { document } = setup(t, {
		available: "fr,es",
		body: '<h1 data-i18n="title">Welcome</h1><p data-i18n="help">Help</p>',
		dictionaries: {
			"/locales/fr.json": { title: "Bonjour", help: "Aide" },
			"/locales/es.json": { title: "Bienvenido" },
		},
	});
	await the.boot({ locale: "fr", persistKeys: [] });
	assert.equal(document.querySelector("p").textContent, "Aide");
	await the.boot({ locale: "es" });
	assert.equal(document.querySelector("h1").textContent, "Bienvenido");
	assert.equal(document.querySelector("p").textContent, "Help");
	assert.equal(
		document.querySelector("p").closest("[lang]").getAttribute("lang"),
		"en",
	);
	await the.boot({ locale: "en" });
	assert.equal(document.querySelector("h1").textContent, "Welcome");
	assert.equal(document.querySelector("h1").hasAttribute("lang"), false);
});

test("invalid fetched dictionaries warn with cause and preserve source", async (t) => {
	const { document } = setup(t, {
		available: "fr",
		dictionaries: { "/locales/fr.json": [] },
	});
	const warnings = t.mock.method(console, "warn", () => {});
	await the.boot({ locale: "fr", persistKeys: [] });
	assert.equal(document.querySelector("h1").textContent, "Welcome");
	assert.equal(the.locale, "en");
	assert.equal(warnings.mock.calls.length, 1);
	assert.ok(warnings.mock.calls[0].arguments[1] instanceof TypeError);
	assert.match(
		warnings.mock.calls[0].arguments[1].message,
		/dictionary must be an object/,
	);
});

test("invalid inline dictionaries are internal contract errors", async (t) => {
	setup(t);
	await assert.rejects(
		the.boot({ dictionary: { title: 1 }, persistKeys: [] }),
		{ name: "TypeError", message: /dictionary entry/ },
	);
});

test("opted-in stored preference selects an available dictionary in its namespace", async (t) => {
	const { document, urls } = setup(t, {
		available: "es",
		dictionaries: { "/locales/es.json": { title: "Bienvenido" } },
	});
	localStorage.setItem("dashboard:lang", "es");
	await the.boot({ namespace: "dashboard", persistKeys: [] });
	assert.equal(the.locale, "en");
	assert.deepEqual(urls, []);
	await the.boot({ persistKeys: ["lang"] });
	assert.equal(the.locale, "es");
	assert.deepEqual(urls, ["/locales/es.json"]);
	assert.equal(document.querySelector("h1").textContent, "Bienvenido");
	await the.boot({ namespace: "otm", persistKeys: [] });
});

test("script fallback never silently selects Cyrillic for Latin Serbian", async (t) => {
	const { document, urls } = setup(t, {
		available: "sr",
		dictionaries: { "/locales/sr.json": { title: "Добро дошли" } },
	});
	await the.boot({ locale: "sr-Latn", persistKeys: [] });
	assert.deepEqual(urls, []);
	assert.equal(the.locale, "en");
	assert.equal(document.querySelector("h1").textContent, "Welcome");
});

test("dictionary matching is canonical while file names retain manifest spelling", async (t) => {
	const { document, urls } = setup(t, {
		available: "FR-ca",
		dictionaries: { "/locales/FR-ca.json": { title: "Allô" } },
	});
	await the.boot({ locale: "fr-ca-u-nu-latn", persistKeys: [] });
	assert.deepEqual(urls, ["/locales/FR-ca.json"]);
	assert.equal(the.locale, "fr-CA-u-nu-latn");
	assert.equal(document.querySelector("h1").lang, "fr-CA");
});

test("failed regional dictionary continues to its language parent with original cause", async (t) => {
	const failure = new TypeError("Network unavailable");
	const { document, urls } = setup(t, {
		available: "fr-CA,fr",
		dictionaries: {
			"/locales/fr-CA.json": failure,
			"/locales/fr.json": { title: "Bonjour" },
		},
	});
	const warnings = t.mock.method(console, "warn", () => {});
	await the.boot({ locale: "fr-CA", persistKeys: [] });
	assert.deepEqual(urls, ["/locales/fr-CA.json", "/locales/fr.json"]);
	assert.equal(document.querySelector("h1").textContent, "Bonjour");
	assert.equal(warnings.mock.calls[0].arguments[1], failure);
});

test("hot dictionary replacement discards old fallback catalogs and restores source misses", async (t) => {
	const { document } = setup(t, {
		available: "fr-CA,fr",
		dictionaries: {
			"/locales/fr-CA.json": {},
			"/locales/fr.json": { title: "Bonjour" },
		},
	});
	await the.boot({ locale: "fr-CA", persistKeys: [] });
	assert.equal(document.querySelector("h1").textContent, "Bonjour");
	the.locale = "es";
	the.dictionary = { unrelated: "Otro" };
	_t();
	assert.equal(document.querySelector("h1").textContent, "Welcome");
	assert.equal(document.querySelector("h1").hasAttribute("lang"), false);
});

test("empty translations are intentional values and inherited object properties are not messages", async (t) => {
	setup(t);
	await the.boot({
		locale: "fr",
		dictionary: { title: "", constructor: "Constructeur" },
		persistKeys: [],
	});
	assert.equal(_t("title"), "");
	assert.equal(_t("constructor"), "Constructeur");
	assert.equal(_t("toString"), "toString");
});

test("invalid locale identifiers fail explicitly", async (t) => {
	setup(t);
	await assert.rejects(
		the.boot({ locale: "fr_CA", persistKeys: [] }),
		RangeError,
	);
});

test("boot preserves the source document's full language declaration", async (t) => {
	const { document } = setup(t, { source: "de-CH-x-source" });
	await the.boot({ locale: "fr", persistKeys: [] });
	assert.equal(document.documentElement.lang, "de-CH-x-source");
});

test("defaultLocale declares a non-English source without requiring html lang", async (t) => {
	const { document, urls } = setup(t, {
		source: "",
		body: '<p data-i18n="title">Willkommen</p>',
	});
	await the.boot({ locale: "fr", defaultLocale: "de", persistKeys: [] });
	assert.equal(the.locale, "de");
	assert.equal(document.querySelector("p").textContent, "Willkommen");
	assert.equal(document.documentElement.lang, "de");
	assert.deepEqual(urls, []);
});
