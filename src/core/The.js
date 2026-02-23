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
		if (!key) {
			const elements = document.querySelectorAll("[data-i18n]");
			for (const el of elements) {
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
				if (options.type === "currency") {
					val = new Intl.NumberFormat(The.locale, {
						style: "currency",
						currency: "USD",
					}).format(num);
				} else if (options.type === "date") {
					const date = new Date(v);
					val = Number.isNaN(date.getTime())
						? v
						: new Intl.DateTimeFormat(The.locale).format(date);
				} else if (options.type === "number") {
					val = new Intl.NumberFormat(The.locale).format(num);
				}
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

		const items = el.querySelectorAll(`[data-text="${key}"]`);
		for (const item of items) {
			item.textContent = val;
		}
		if (el.getAttribute("data-text") === key) el.textContent = val;

		return el;
	}

	static async handshake() {
		const search = typeof window !== "undefined" ? window.location.search : "";
		const params = new URLSearchParams(search);
		The.locale =
			params.get("lang") ||
			localStorage.getItem("lang") ||
			(typeof navigator !== "undefined" ? navigator.language : null) ||
			document.documentElement.lang ||
			"en";

		const meta = document.querySelector('meta[name="i18n"]');
		if (meta) {
			const path = meta.getAttribute("content");
			const fallback = meta.getAttribute("data-fallback") || "en";
			const base = The.locale.split("-")[0].toLowerCase();
			const full = The.locale.toLowerCase();

			const tryFetch = async (l) => {
				try {
					const res = await fetch(`${path}/${l}.json`);
					return res.ok ? await res.json() : null;
				} catch {
					return null;
				}
			};

			The.dictionary =
				(await tryFetch(full)) ||
				(await tryFetch(base)) ||
				(await tryFetch(fallback)) ||
				{};
		}

		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key !== "lang") The.#setGlobal(key, localStorage.getItem(key));
		}

		The._t();
	}
}
