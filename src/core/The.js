export default class The {
	static dictionary = {};
	static locale = typeof navigator !== "undefined" ? navigator.language : "en";
	static prefix = "otm:";
	// Default: nothing persists. Opt in per key via the.boot({ persistKeys }).
	static persistKeys = new Set();

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

	static match(pattern, path) {
		const subject =
			path ??
			(typeof window !== "undefined" && window.location
				? window.location.pathname
				: "");
		const paramNames = [];
		const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regexSource = escaped.replace(
			/:([a-zA-Z_][a-zA-Z0-9_]*)/g,
			(_, name) => {
				paramNames.push(name);
				return "([^/]+)";
			},
		);
		const m = subject.match(new RegExp(`^${regexSource}$`));
		if (!m) return null;
		const out = {};
		paramNames.forEach((name, i) => {
			out[name] = decodeURIComponent(m[i + 1]);
		});
		return out;
	}

	static flat(obj, sep = "_") {
		if (obj === null || typeof obj !== "object") {
			throw new TypeError("the.flat: input must be an object");
		}
		const out = {};
		const walk = (val, prefix) => {
			if (val === null || typeof val !== "object") {
				out[prefix] = val;
				return;
			}
			for (const [k, v] of Object.entries(val)) {
				walk(v, prefix ? `${prefix}${sep}${k}` : k);
			}
		};
		walk(obj, "");
		return out;
	}

	static form(formEl) {
		const obj = {};
		const controls = formEl.querySelectorAll("input, select, textarea");

		for (const el of controls) {
			const name = el.name;
			if (!name || el.disabled) continue;

			const type = (el.type || "text").toLowerCase();
			if (type === "submit" || type === "button" || type === "reset") continue;
			if (type === "file") continue;

			if (type === "checkbox" || type === "radio") {
				const checked = el.checked ?? el.hasAttribute("checked");
				if (!checked) continue;
			}

			if (el.tagName === "SELECT" && el.hasAttribute("multiple")) {
				// selectedOptions in browsers; attribute query under linkedom (tests).
				const opts =
					"selectedOptions" in el
						? el.selectedOptions
						: el.querySelectorAll("option[selected]");
				for (const opt of opts) The.#assign(obj, name, opt.value);
				continue;
			}

			const value = el.value ?? el.getAttribute("value") ?? "";
			The.#assign(obj, name, value);
		}
		return obj;
	}

	static #assign(obj, key, value) {
		// name="tags[]" is an array from the first entry — shape must not
		// depend on cardinality.
		const isArrayLeaf = key.endsWith("[]");
		const parts = key.split(/[\[\]]/).filter(Boolean);
		let current = obj;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isLast = i === parts.length - 1;
			if (isLast) {
				if (isArrayLeaf) {
					current[part] ||= [];
					current[part].push(value);
				} else if (current[part] !== undefined) {
					if (!Array.isArray(current[part])) current[part] = [current[part]];
					current[part].push(value);
				} else {
					current[part] = value;
				}
			} else {
				current[part] = current[part] || {};
				current = current[part];
			}
		}
	}

	static _t(key, options = {}) {
		const isNode =
			typeof Node !== "undefined" ? key instanceof Node : key?.nodeType;
		if (isNode) {
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
					const resolved = The.#resolve(k, { ...params, type });
					// Miss → preserve the source-language fallback text already inside.
					if (resolved !== null) el.textContent = resolved;
				}
			}
			return key;
		}

		if (!key) {
			The._t(document.body);
			return "";
		}

		return The.#resolve(key, options) ?? key;
	}

	// Returns the localized string, or null on a true miss (no dictionary
	// entry and no Intl-only formatting path).
	static #resolve(key, options) {
		let entry = The.dictionary[key];
		if (!entry) {
			if (
				options.val !== undefined &&
				(options.type === "currency" || options.type === "date")
			) {
				const fmt =
					options.type === "currency"
						? new Intl.NumberFormat(The.locale, {
								style: "currency",
								currency: "USD",
							})
						: new Intl.DateTimeFormat(The.locale);
				return options.type === "date"
					? fmt.format(new Date(options.val))
					: fmt.format(Number(options.val));
			}
			return null;
		}

		if (typeof entry === "object") {
			const qty = options.qty !== undefined ? Number(options.qty) : 0;
			const rule = new Intl.PluralRules(The.locale).select(qty);
			entry = entry[rule] || entry.other || key;
		}

		if (typeof entry !== "string") return key;

		let result = entry;
		for (const [k, v] of Object.entries(options)) {
			let val = v;
			if (k === "val" && options.type) {
				const num = Number(v);
				const fmt =
					options.type === "currency"
						? new Intl.NumberFormat(The.locale, {
								style: "currency",
								currency: "USD",
							})
						: options.type === "date"
							? new Intl.DateTimeFormat(The.locale)
							: new Intl.NumberFormat(The.locale);
				val =
					options.type === "date" ? fmt.format(new Date(v)) : fmt.format(num);
			}
			// Function replacement keeps $-patterns in values inert.
			result = result.replaceAll(`{${k}}`, () => val);
		}

		return result;
	}

	static #routeNavigate = null;

	static route(callback, { match } = {}) {
		if (typeof window === "undefined") return;
		if (The.#routeNavigate) {
			throw new Error(
				"route(): a router is already active — call its unsubscribe first",
			);
		}

		const navigate = () =>
			callback(
				window.location.pathname,
				window.location.search,
				window.location.hash,
			);
		The.#routeNavigate = navigate;

		const onClick = (e) => {
			// Modified clicks (new tab, context menu chords) belong to the browser.
			if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0)
				return;
			const link = e.target.closest("a");
			if (
				!link ||
				!link.getAttribute("href") ||
				link.hasAttribute("data-external") ||
				link.hasAttribute("download") ||
				link.target === "_blank"
			) {
				return;
			}
			// Selective enhancement: with a match selector, only opted-in links
			// are intercepted — everything else navigates natively.
			if (match && !link.matches(match)) return;

			const url = new URL(link.getAttribute("href"), window.location.href);
			if (url.origin !== window.location.origin) return;

			if (
				url.pathname === window.location.pathname &&
				url.search === window.location.search &&
				url.hash
			) {
				return;
			}

			e.preventDefault();
			if (url.href === window.location.href) return;
			window.history.pushState({}, "", url.href);
			navigate();
		};

		window.addEventListener("popstate", navigate);
		window.addEventListener("hashchange", navigate);
		document.addEventListener("click", onClick);

		navigate();

		return () => {
			window.removeEventListener("popstate", navigate);
			window.removeEventListener("hashchange", navigate);
			document.removeEventListener("click", onClick);
			The.#routeNavigate = null;
		};
	}

	// Programmatic navigation. pushState doesn't fire popstate, so the click
	// interceptor can't cover redirects (e.g. post-submit).
	static go(path) {
		if (typeof window === "undefined") return;
		if (!The.#routeNavigate) {
			throw new Error("route.go(): no active router — call route() first");
		}
		const url = new URL(path, window.location.href);
		if (url.href === window.location.href) return;
		window.history.pushState({}, "", url.href);
		The.#routeNavigate();
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
		The.#set(el, k, v);
		if (isGlobal && The.persistKeys.has(k))
			localStorage.setItem(`${The.prefix}${k}`, v);
	}

	static #get(el, key) {
		return el.getAttribute(The.#attr(el, key));
	}

	static #set(el, key, val) {
		const out = typeof val === "boolean" ? (val ? "true" : "false") : val;
		el.setAttribute(The.#attr(el, key), out);
		The.#mirror(el, key, out, false);
	}

	static #delete(el, key) {
		el.removeAttribute(The.#attr(el, key));
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
				item.textContent = out;
			// data-bind="attr:key attr2:key2" — attribute projection. The *=
			// selector over-matches on substrings; #bindApply parse-verifies.
			for (const item of root.querySelectorAll(`[data-bind*="${key}"]`))
				The.#bindApply(item, key, out, removed);
		}
		if (el.getAttribute?.("data-text") === key) el.textContent = out;
		The.#bindApply(el, key, out, removed);
	}

	static #bindApply(item, key, out, removed) {
		const spec = item.getAttribute?.("data-bind");
		if (!spec) return;
		for (const pair of spec.split(/\s+/)) {
			const i = pair.indexOf(":");
			if (i < 1 || pair.slice(i + 1) !== key) continue;
			const attr = pair.slice(0, i);
			if (removed) item.removeAttribute(attr);
			else item.setAttribute(attr, out);
		}
	}

	static async boot({
		signal,
		locales,
		dictionary,
		namespace,
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
		// already considered the visitor's preference when choosing it. Static SPAs
		// that want navigator-driven locale detection should leave <html lang> empty
		// or omit the attribute — then the chain falls through to navigator.
		const browserLoc =
			document.documentElement.lang ||
			(typeof navigator !== "undefined" ? navigator.language : null) ||
			"en";

		The.locale =
			params.get("lang") ||
			localStorage.getItem(`${The.prefix}lang`) ||
			browserLoc;

		const sourceLang = defaultLocale || document.documentElement.lang;
		const localeBase = The.locale.toLowerCase().split("-")[0];
		const sourceBase = sourceLang?.toLowerCase().split("-")[0];
		const skipI18n = Boolean(sourceBase) && localeBase === sourceBase;

		// Inline dictionary always loads — programmatic _t() must work even when
		// the locale short-circuit skips the fetch and the hydration pass.
		if (dictionary) {
			The.dictionary = dictionary;
		} else if (!skipI18n) {
			const meta = document.querySelector('meta[name="i18n"]');
			const path = locales || meta?.getAttribute("content");
			if (path) {
				const fallback = meta?.getAttribute("data-fallback") || "en";
				const available = (meta?.getAttribute("data-available") || "")
					.split(",")
					.map((s) => s.trim().toLowerCase());

				const full = The.locale.toLowerCase();
				const base = full.split("-")[0];

				let target = fallback;
				if (available.includes(full)) target = full;
				else if (available.includes(base)) target = base;

				const load = async (loc) => {
					const res = await fetch(`${path}/${loc}.json`, { signal });
					if (!res.ok) throw new Error(`HTTP ${res.status} for ${loc}.json`);
					return res.json();
				};

				try {
					The.dictionary = await load(target);
				} catch (e) {
					if (signal?.aborted) throw e;
					console.warn(`otm: i18n fetch failed for "${target}"`, e);
					if (target !== fallback) {
						try {
							The.dictionary = await load(fallback);
						} catch (e2) {
							if (signal?.aborted) throw e2;
							console.warn(`otm: i18n fallback "${fallback}" failed`, e2);
						}
					}
				}
			}
		}

		for (let i = 0; i < localStorage.length; i++) {
			const fullKey = localStorage.key(i);
			if (fullKey.startsWith(The.prefix)) {
				const key = fullKey.slice(The.prefix.length);
				if (key !== "lang" && The.persistKeys.has(key)) {
					const val = localStorage.getItem(fullKey);
					The.#set(document.body, key, val);
				}
			}
		}

		if (!skipI18n) The._t();
	}
}
