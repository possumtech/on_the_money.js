export default class The {
	static dictionary = {};
	static locale =
		typeof navigator !== "undefined" ? navigator.language : "en-US";
	static ready = null;
	static #prefix = "otm:";

	static the(...args) {
		if (args.length === 1 && typeof args[0] === "string") {
			return The.#getScoped(document.body, args[0]);
		}

		if (
			args.length === 1 &&
			typeof window !== "undefined" &&
			args[0] instanceof HTMLFormElement
		) {
			return The.#fromForm(args[0]);
		}

		if (args.length === 1 && typeof args[0] === "object") {
			for (const [k, v] of Object.entries(args[0])) {
				The.#setGlobal(k, v);
			}
			return document.body;
		}

		if (args.length === 2 && typeof args[1] === "undefined") {
			return The.#getScoped(args[0], args[1]);
		}

		if (args.length === 2 && typeof args[0] === "string") {
			return The.#setGlobal(args[0], args[1]);
		}

		const [el, key, val] = args;
		if (typeof val === "undefined" && typeof key === "string") {
			return The.#getScoped(el, key);
		}

		if (typeof key === "object") {
			for (const [k, v] of Object.entries(key)) {
				The.#setScoped(el, k, v);
			}
			return el;
		}

		return The.#setScoped(el, key, val);
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
		if (!entry) return key;

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

	/**
	 * Non-opinionated Surgical Router.
	 * Intercepts internal link clicks and provides a callback for URL changes.
	 * @param {Function} callback - Called whenever the URL changes
	 */
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
				!link.href ||
				link.origin !== window.location.origin ||
				link.hasAttribute("data-external") ||
				link.target === "_blank"
			) {
				return;
			}

			// If it's just a hash on the current page, let the browser handle scrolling
			// but we still listen for 'hashchange' to trigger the callback.
			if (
				link.pathname === window.location.pathname &&
				link.search === window.location.search &&
				link.hash
			) {
				return;
			}

			e.preventDefault();
			window.history.pushState({}, "", link.href);
			navigate();
		});

		// Initial route
		navigate();
	}

	static #fromForm(form) {
		const data = new FormData(form);
		const obj = {};

		for (const [key, value] of data.entries()) {
			// Handle nested keys like user[name] or hobbies[]
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
		return obj;
	}

	static #setGlobal(key, val) {
		The.#setScoped(document.body, key, val);
		localStorage.setItem(`${The.#prefix}${key}`, val);
		const elements = document.querySelectorAll(`[data-text="${key}"]`);
		for (const el of elements) {
			el.textContent = val;
		}
	}

	static #getScoped(el, key) {
		const ariaMap = {
			expanded: "aria-expanded",
			selected: "aria-selected",
			hidden: "aria-hidden",
			checked: "aria-checked",
			disabled: "aria-disabled",
		};

		const attr = ariaMap[key] || `data-${key}`;
		return el.getAttribute(attr);
	}

	static #setScoped(el, key, val) {
		const ariaMap = {
			expanded: "aria-expanded",
			selected: "aria-selected",
			hidden: "aria-hidden",
			checked: "aria-checked",
			disabled: "aria-disabled",
		};

		const attr = ariaMap[key] || `data-${key}`;
		el.setAttribute(attr, val);

		if (el.querySelectorAll) {
			const items = el.querySelectorAll(`[data-text="${key}"]`);
			for (const item of items) {
				item.textContent = val;
			}
		}
		if (el.getAttribute?.("data-text") === key) el.textContent = val;

		return el;
	}

	static async handshake() {
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
			localStorage.getItem(`${The.#prefix}lang`) ||
			browserLoc;

		const meta = document.querySelector('meta[name="i18n"]');
		if (meta) {
			const path = meta.getAttribute("content");
			const fallback = meta.getAttribute("data-fallback") || "en";
			const available = (meta.getAttribute("data-available") || "")
				.split(",")
				.map((s) => s.trim().toLowerCase());

			const full = The.locale.toLowerCase();
			const base = full.split("-")[0];

			let target = fallback;
			if (available.includes(full)) target = full;
			else if (available.includes(base)) target = base;

			try {
				const res = await fetch(`${path}/${target}.json`);
				if (res.ok) {
					The.dictionary = await res.json();
				}
			} catch (e) {
				console.warn("otm: i18n fetch failed", e);
			}
		}

		for (let i = 0; i < localStorage.length; i++) {
			const fullKey = localStorage.key(i);
			if (fullKey.startsWith(The.#prefix)) {
				const key = fullKey.slice(The.#prefix.length);
				if (key !== "lang") {
					const val = localStorage.getItem(fullKey);
					The.#setScoped(document.body, key, val);
					const elements = document.querySelectorAll(`[data-text="${key}"]`);
					for (const el of elements) {
						el.textContent = val;
					}
				}
			}
		}

		The._t();
	}
}
