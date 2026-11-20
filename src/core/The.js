import Dictionary from "./Dictionary.js";
import { extractForm, flat } from "./Form.js";
import Locale from "./Locale.js";
import { go, match, route } from "./Router.js";

export default class The {
	static #dictionaries = [{ dictionary: {}, locale: null }];
	static #sourceText = new WeakMap();
	static locale = typeof navigator !== "undefined" ? navigator.language : "en";
	static prefix = "otm:";
	// Default: nothing persists. Opt in per key via the.boot({ persistKeys }).
	static persistKeys = new Set();

	static get dictionary() {
		return The.#dictionaries[0].dictionary;
	}

	static set dictionary(value) {
		The.#dictionaries = [
			{ dictionary: Dictionary.validate(value), locale: null },
		];
	}

	// Normalize keys to kebab-case for DOM attributes and [data-text] lookups.
	// chapterHasNav → chapter-has-nav. chapter_has_nav → chapter-has-nav.
	// expanded / mounted / theme → unchanged.
	static #kebab(key) {
		return key
			.replace(/_/g, "-")
			.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
			.toLowerCase();
	}

	static the(...args) {
		if (args.length === 0) {
			throw new TypeError("the(): missing args");
		}
		if (args[0] instanceof Element) {
			return The.#on(args[0], args.slice(1));
		}
		return The.#on(document.body, args);
	}

	static #on(el, args) {
		const [a, b] = args;
		const isGlobal = el === document.body;

		if (args.length === 1 && typeof a === "string") {
			return The.#get(el, The.#kebab(a));
		}
		if (args.length === 2 && typeof a === "string") {
			if (typeof b === "undefined") {
				throw new TypeError(
					`the(${JSON.stringify(a)}, undefined): val is required for set`,
				);
			}
			The.#write(el, isGlobal, a, b);
			return el;
		}
		if (args.length === 1 && a?.constructor === Object) {
			for (const [rawKey, v] of Object.entries(a)) {
				The.#write(el, isGlobal, rawKey, v);
			}
			return el;
		}

		throw new TypeError(
			`the(): unrecognized call shape (${args.map((x) => typeof x).join(", ")})`,
		);
	}

	static match = match;
	static flat = flat;
	static form = extractForm;
	static route = route;
	static go = go;

	static _t(key, options = {}) {
		const isNode =
			typeof Node !== "undefined" ? key instanceof Node : key?.nodeType;
		if (isNode) {
			The.#translate(key);
			return key;
		}

		if (!key) {
			The.#translate(document.documentElement);
			return "";
		}

		return The.#resolve(key, options)?.text ?? key;
	}

	static #translate(key, sourceOnly = false) {
		const elements = key.querySelectorAll
			? [key, ...key.querySelectorAll("[data-i18n]")]
			: [key];
		for (const el of elements) {
			if (el.hasAttribute?.("data-i18n")) {
				const k = el.getAttribute("data-i18n");
				const params = {};
				for (const attr of el.attributes) {
					if (
						attr.name.startsWith("data-i18n-") &&
						attr.name !== "data-i18n-type"
					) {
						const paramName = attr.name.replace("data-i18n-", "");
						params[paramName] = attr.value;
					}
				}
				const type = el.getAttribute("data-i18n-type");
				const resolved = sourceOnly
					? null
					: The.#resolve(k, { ...params, type });
				const source = The.#sourceText.get(el);
				if (resolved !== null) {
					if (!source)
						The.#sourceText.set(el, {
							text: el.textContent,
							lang: el.getAttribute("lang"),
						});
					The.#projectText(el, resolved.text);
					The.#projectAttribute(el, "lang", resolved.locale);
				} else if (source) {
					The.#projectText(el, source.text);
					The.#projectAttribute(el, "lang", source.lang);
				}
			}
		}
	}

	// The framework ships Intl plumbing, never a currency choice: no
	// default — the platform itself refuses to infer currency from locale,
	// and Intl throws RangeError on invalid ISO 4217 codes.
	static #currency(options) {
		if (!options.currency) {
			throw new TypeError(
				'_t: type "currency" requires an explicit currency (options.currency or data-i18n-currency)',
			);
		}
		return options.currency;
	}

	// Keep the supplying language with the message, including fallback entries.
	static #resolve(key, options) {
		const found = The.#dictionaries.find(({ dictionary }) =>
			Object.hasOwn(dictionary, key),
		);
		let entry = found?.dictionary[key];
		const language = found?.locale ?? The.locale;
		const formatLocale = Locale.compatible(The.locale, language)
			? The.locale
			: language;
		if (entry === undefined) {
			if (
				options.val !== undefined &&
				(options.type === "currency" || options.type === "date")
			) {
				const fmt =
					options.type === "currency"
						? new Intl.NumberFormat(The.locale, {
								style: "currency",
								currency: The.#currency(options),
							})
						: new Intl.DateTimeFormat(The.locale);
				const text =
					options.type === "date"
						? fmt.format(new Date(options.val))
						: fmt.format(Number(options.val));
				return { text, locale: The.locale };
			}
			return null;
		}

		if (typeof entry === "object") {
			const qty = options.qty !== undefined ? Number(options.qty) : 0;
			const rule = new Intl.PluralRules(language).select(qty);
			entry = entry[rule] ?? entry.other ?? key;
		}

		if (typeof entry !== "string")
			throw new TypeError(
				`Invalid i18n dictionary entry ${JSON.stringify(key)}`,
			);

		let result = entry;
		for (const [k, v] of Object.entries(options)) {
			let val = v;
			if (k === "val" && options.type) {
				const num = Number(v);
				const fmt =
					options.type === "currency"
						? new Intl.NumberFormat(formatLocale, {
								style: "currency",
								currency: The.#currency(options),
							})
						: options.type === "date"
							? new Intl.DateTimeFormat(formatLocale)
							: new Intl.NumberFormat(formatLocale);
				val =
					options.type === "date" ? fmt.format(new Date(v)) : fmt.format(num);
			}
			// Function replacement keeps $-patterns in values inert.
			result = result.replaceAll(`{${k}}`, () => val);
		}

		return { text: result, locale: language };
	}

	// ARIA mapping: HTML5 widget/form boolean states only. Closed set; no future
	// expansion. Other ARIA attributes (aria-invalid, aria-controls, etc.) go
	// through el.setAttribute("aria-...", val) like any HTML attribute.
	static #ariaMap = {
		expanded: "aria-expanded",
		selected: "aria-selected",
		hidden: "aria-hidden",
		checked: "aria-checked",
		disabled: "aria-disabled",
	};

	// ARIA widget states are element-scoped; global state on body is always
	// data-* (the("hidden", true) must never aria-hide the whole app).
	static #attr(el, key) {
		if (el === document.body) return `data-${key}`;
		return The.#ariaMap[key] || `data-${key}`;
	}

	// null deletes; anything else sets. Persistence mirrors the same polarity.
	static #write(el, isGlobal, rawKey, v) {
		const k = The.#kebab(rawKey);
		if (v === null) {
			The.#delete(el, k);
			if (isGlobal && The.persistKeys.has(k))
				localStorage.removeItem(`${The.prefix}${k}`);
			return;
		}
		const out = The.#stateValue(k, v);
		The.#set(el, k, out);
		if (isGlobal && The.persistKeys.has(k))
			localStorage.setItem(`${The.prefix}${k}`, out);
	}

	static #stateValue(key, val) {
		if (typeof val === "string") return val;
		if (typeof val === "boolean") return val ? "true" : "false";
		if (typeof val === "number" && Number.isFinite(val)) return String(val);
		throw new TypeError(
			`the(${JSON.stringify(key)}, ...): state value must be a string, finite number, boolean, or null`,
		);
	}

	static #get(el, key) {
		return el.getAttribute(The.#attr(el, key));
	}

	static #projectText(el, value) {
		if (el.textContent !== value) el.textContent = value;
	}

	static #projectAttribute(el, name, value) {
		if (el.getAttribute(name) === value) return;
		if (value === null) el.removeAttribute(name);
		else el.setAttribute(name, value);
	}

	static #set(el, key, val) {
		The.#projectAttribute(el, The.#attr(el, key), val);
		The.#mirror(el, key, val, false);
	}

	static #delete(el, key) {
		The.#projectAttribute(el, The.#attr(el, key), null);
		The.#mirror(el, key, "", true);
	}

	static #mirror(el, key, out, removed) {
		// Global writes (body) walk the whole document so [data-text="key"]
		// slots in <head> (e.g. <title data-text="title">) hydrate too.
		// Scoped writes stay within el.
		const root =
			el === document.body && typeof document !== "undefined"
				? document.documentElement || document
				: el;
		if (root.querySelectorAll) {
			for (const item of root.querySelectorAll(`[data-text="${key}"]`))
				The.#projectText(item, out);
			// data-bind="attr:key attr2:key2" — attribute projection. The *=
			// selector over-matches on substrings; #bindApply parse-verifies.
			for (const item of root.querySelectorAll(`[data-bind*="${key}"]`))
				The.#bindApply(item, key, out, removed);
		}
		if (el.getAttribute?.("data-text") === key) The.#projectText(el, out);
		The.#bindApply(el, key, out, removed);
	}

	static #bindApply(item, key, out, removed) {
		const spec = item.getAttribute?.("data-bind");
		if (!spec) return;
		for (const pair of spec.split(/\s+/)) {
			const i = pair.indexOf(":");
			if (i < 1 || pair.slice(i + 1) !== key) continue;
			const attr = pair.slice(0, i);
			The.#projectAttribute(item, attr, removed ? null : out);
		}
	}

	static async boot({
		signal,
		locales,
		dictionary,
		namespace,
		locale,
		defaultLocale,
		persistKeys,
	} = {}) {
		if (namespace) The.prefix = `${namespace}:`;
		if (persistKeys)
			The.persistKeys = new Set(persistKeys.map((k) => The.#kebab(k)));
		const search =
			typeof window !== "undefined" && window.location
				? window.location.search
				: "";
		const params = new URLSearchParams(search);
		// <html lang> is the server's deliberate signal about the rendered document's
		// language. It outranks navigator.language because the server may have
		// already considered the visitor's preference when choosing it. Browser-led
		// selection can be explicit without removing the document's source language.
		const browserLoc =
			document.documentElement.lang ||
			(typeof navigator !== "undefined" ? navigator.language : null) ||
			"en";

		const requested = new Intl.Locale(
			locale ||
				params.get("lang") ||
				(The.persistKeys.has("lang") &&
					localStorage.getItem(`${The.prefix}lang`)) ||
				browserLoc,
		).toString();

		const sourceLang = defaultLocale || document.documentElement.lang;
		const source = sourceLang ? new Intl.Locale(sourceLang).baseName : null;
		if (defaultLocale)
			The.#projectAttribute(
				document.documentElement,
				"lang",
				new Intl.Locale(defaultLocale).toString(),
			);
		const dictionaries = [];

		if (dictionary !== undefined) {
			dictionaries.push({
				dictionary: Dictionary.validate(dictionary),
				locale: requested,
			});
		} else {
			const meta = document.querySelector('meta[name="i18n"]');
			const path = locales || meta?.getAttribute("content");
			if (path) {
				const fallback = meta?.getAttribute("data-fallback") || source || "en";
				const available = new Map(
					(meta?.getAttribute("data-available") || "")
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
						.map((tag) => [new Intl.Locale(tag).baseName, tag]),
				);
				const primary = Locale.chain(requested);
				if (source && Locale.compatible(requested, source))
					primary.push(source);
				const candidates = new Set([
					...primary,
					...Locale.chain(fallback),
					...(source ? [source] : []),
				]);
				for (const target of candidates) {
					if (target === source && !available.has(target)) break;
					const file =
						available.get(target) ??
						(available.size === 0 &&
						target === new Intl.Locale(fallback).baseName
							? fallback
							: null);
					if (!file) continue;
					try {
						const res = await fetch(`${path}/${file}.json`, { signal });
						if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}.json`);
						dictionaries.push({
							dictionary: Dictionary.validate(await res.json()),
							locale: target,
						});
					} catch (cause) {
						if (signal?.aborted) throw cause;
						console.warn(`otm: i18n fetch failed for "${target}"`, cause);
					}
					if (target === source) break;
				}
			}
		}
		const active = dictionaries[0]?.locale ?? source ?? requested;
		The.locale = Locale.compatible(requested, active) ? requested : active;
		The.#dictionaries = dictionaries.length
			? dictionaries
			: [{ dictionary: {}, locale: null }];

		for (const key of The.persistKeys) {
			if (key === "lang") continue;
			const val = localStorage.getItem(`${The.prefix}${key}`);
			if (val !== null) The.#set(document.body, key, val);
		}

		The.#translate(
			document.documentElement,
			source !== null && dictionaries.length === 0,
		);
	}
}
