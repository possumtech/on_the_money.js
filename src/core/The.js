export default class The {
	static dictionary = {};
	static locale =
		typeof navigator !== "undefined" ? navigator.language : "en-US";
	static prefix = "otm:";
	static ephemeralKeys = new Set();

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
			return The.#get(el, a);
		}
		if (args.length === 2 && typeof a === "string") {
			if (typeof b === "undefined") {
				throw new TypeError(
					`the(${JSON.stringify(a)}, undefined): val is required for set`,
				);
			}
			The.#set(el, a, b);
			if (isGlobal && !The.ephemeralKeys.has(a))
				localStorage.setItem(`${The.prefix}${a}`, b);
			return el;
		}
		if (args.length === 1 && a?.constructor === Object) {
			for (const [k, v] of Object.entries(a)) {
				The.#set(el, k, v);
				if (isGlobal && !The.ephemeralKeys.has(k))
					localStorage.setItem(`${The.prefix}${k}`, v);
			}
			return el;
		}

		throw new TypeError(
			`the(): unrecognized call shape (${args.map((x) => typeof x).join(", ")})`,
		);
	}

	static title(str) {
		document.title = str;
		return document.querySelector("title");
	}

	static attr(el, nameOrObj, val) {
		if (typeof nameOrObj === "string") {
			el.setAttribute(nameOrObj, val);
			return el;
		}
		if (nameOrObj?.constructor === Object) {
			for (const [k, v] of Object.entries(nameOrObj)) el.setAttribute(k, v);
			return el;
		}
		throw new TypeError(
			"the.attr: second arg must be a string or plain object",
		);
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

			if (type === "checkbox" || type === "radio") {
				const checked = el.checked ?? el.hasAttribute("checked");
				if (!checked) continue;
			}

			const value = el.value ?? el.getAttribute("value") ?? "";
			The.#assign(obj, name, value);
		}
		return obj;
	}

	static #assign(obj, key, value) {
		const parts = key.split(/[\[\]]/).filter(Boolean);
		let current = obj;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isLast = i === parts.length - 1;
			if (isLast) {
				if (current[part] !== undefined) {
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
					el.textContent = The._t(k, { ...params, type });
				}
			}
			return key;
		}

		if (!key) {
			The._t(document.body);
			return "";
		}

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
			return key;
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
			result = result.replace(`{${k}}`, val);
		}

		return result;
	}

	static route(callback) {
		if (typeof window === "undefined") return;

		const navigate = () =>
			callback(
				window.location.pathname,
				window.location.search,
				window.location.hash,
			);

		window.addEventListener("popstate", navigate);
		window.addEventListener("hashchange", navigate);

		document.addEventListener("click", (e) => {
			const link = e.target.closest("a");
			if (
				!link ||
				!link.getAttribute("href") ||
				link.hasAttribute("data-external") ||
				link.target === "_blank"
			) {
				return;
			}

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
			window.history.pushState({}, "", url.href);
			navigate();
		});

		navigate();
	}

	static #ariaMap = {
		expanded: "aria-expanded",
		selected: "aria-selected",
		hidden: "aria-hidden",
		checked: "aria-checked",
		disabled: "aria-disabled",
		invalid: "aria-invalid",
		required: "aria-required",
		readonly: "aria-readonly",
		pressed: "aria-pressed",
		current: "aria-current",
	};

	static #get(el, key) {
		const attr = The.#ariaMap[key] || `data-${key}`;
		return el.getAttribute(attr);
	}

	static #set(el, key, val) {
		const attr = The.#ariaMap[key] || `data-${key}`;
		const out = typeof val === "boolean" ? (val ? "true" : "false") : val;
		el.setAttribute(attr, out);

		if (el.querySelectorAll) {
			const items = el.querySelectorAll(`[data-text="${key}"]`);
			for (const item of items) item.textContent = out;
		}
		if (el.getAttribute?.("data-text") === key) el.textContent = out;
	}

	static async boot({
		signal,
		locales,
		dictionary,
		namespace,
		defaultLocale,
		ephemeralKeys,
	} = {}) {
		if (namespace) The.prefix = `${namespace}:`;
		if (ephemeralKeys) The.ephemeralKeys = new Set(ephemeralKeys);
		const search =
			typeof window !== "undefined" && window.location
				? window.location.search
				: "";
		const params = new URLSearchParams(search);
		const browserLoc =
			(typeof navigator !== "undefined" ? navigator.language : null) ||
			document.documentElement.lang ||
			"en";

		The.locale =
			params.get("lang") ||
			localStorage.getItem(`${The.prefix}lang`) ||
			browserLoc;

		const sourceLang = defaultLocale || document.documentElement.lang;
		const localeBase = The.locale.toLowerCase().split("-")[0];
		const sourceBase = sourceLang?.toLowerCase().split("-")[0];
		const skipI18n = Boolean(sourceBase) && localeBase === sourceBase;

		if (!skipI18n) {
			if (dictionary) {
				The.dictionary = dictionary;
			} else {
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

					try {
						const res = await fetch(`${path}/${target}.json`, { signal });
						if (res.ok) The.dictionary = await res.json();
					} catch (e) {
						if (signal?.aborted) throw e;
						console.warn("otm: i18n fetch failed", e);
					}
				}
			}
		}

		for (let i = 0; i < localStorage.length; i++) {
			const fullKey = localStorage.key(i);
			if (fullKey.startsWith(The.prefix)) {
				const key = fullKey.slice(The.prefix.length);
				if (key !== "lang" && !The.ephemeralKeys.has(key)) {
					const val = localStorage.getItem(fullKey);
					The.#set(document.body, key, val);
				}
			}
		}

		if (!skipI18n) The._t();
	}
}
