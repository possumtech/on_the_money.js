export default class The {
	static dictionary = {};
	static locale =
		typeof navigator !== "undefined" ? navigator.language : "en-US";
	static ready = null;

	static the(...args) {
		if (args.length === 2 && typeof args[0] === "string") {
			return The.#setGlobal(args[0], args[1]);
		}

		const [el, key, val] = args;
		if (typeof key === "object") {
			for (const [k, v] of Object.entries(key)) {
				The.#setScoped(el, k, v);
			}
			return el;
		}

		return The.#setScoped(el, key, val);
	}

	static _t(key, options = {}) {
		// Surgical Hydration
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

	static #setGlobal(key, val) {
		The.#setScoped(document.body, key, val);
		localStorage.setItem(key, val);
		const elements = document.querySelectorAll(`[data-text="${key}"]`);
		for (const el of elements) {
			el.textContent = val;
		}
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
			params.get("lang") || localStorage.getItem("lang") || browserLoc;

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
				if (res.ok) The.dictionary = await res.json();
			} catch (e) {
				console.warn("otm: i18n fetch failed", e);
			}
		}

		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key !== "lang") {
				const val = localStorage.getItem(key);
				The.#setScoped(document.body, key, val);
				const elements = document.querySelectorAll(`[data-text="${key}"]`);
				for (const el of elements) {
					el.textContent = val;
				}
			}
		}

		The._t();
	}
}
