export default class On {
	// One native DOM listener per (container, event) pair; WeakMap lets
	// detached subtrees garbage-collect automatically.
	static #registry = new WeakMap();

	static on(parent, event, selector, fn) {
		if (
			typeof selector !== "string" ||
			!selector.trim() ||
			typeof fn !== "function"
		) {
			throw new TypeError("on(): expected (parent, event, selector, handler)");
		}
		const container =
			typeof parent === "string"
				? document.querySelector(parent)
				: parent || document.body;
		if (!container) {
			throw new Error(`on(): parent selector matched nothing: ${parent}`);
		}

		let byEvent = On.#registry.get(container);
		if (!byEvent) {
			byEvent = new Map();
			On.#registry.set(container, byEvent);
		}
		let bucket = byEvent.get(event);
		if (!bucket) {
			const entries = new Set();
			const dispatch = (e) => {
				const raw = e.target;
				const origin =
					raw && typeof raw.closest === "function"
						? raw
						: raw?.parentElement || null;
				if (!origin) return;
				for (const entry of [...entries]) {
					if (!entries.has(entry)) continue;
					const target = origin.closest(entry.selector);
					if (target && container.contains(target)) {
						entry.fn.call(target, e, target);
					}
				}
			};
			bucket = { dispatch, entries };
			byEvent.set(event, bucket);
			container.addEventListener(event, dispatch);
		}

		const entry = { selector, fn };
		bucket.entries.add(entry);

		return () => {
			bucket.entries.delete(entry);
			if (bucket.entries.size === 0 && byEvent.get(event) === bucket) {
				container.removeEventListener(event, bucket.dispatch);
				byEvent.delete(event);
				if (byEvent.size === 0) On.#registry.delete(container);
			}
		};
	}

	static target(target, event, fn, options = {}) {
		if (
			!target ||
			typeof target.addEventListener !== "function" ||
			(typeof Element !== "undefined" && target instanceof Element)
		) {
			throw new TypeError(
				"on.target(): expected a non-Element EventTarget; use delegated on(parent, event, selector, handler) for DOM elements",
			);
		}
		if (
			typeof event !== "string" ||
			!event.trim() ||
			typeof fn !== "function" ||
			options === null ||
			typeof options !== "object"
		) {
			throw new TypeError(
				"on.target(): expected (target, event, handler, options?)",
			);
		}
		const { signal, ...listenerOptions } = options;
		if (signal?.aborted) return () => {};
		const hasOptions = Object.keys(listenerOptions).length > 0;
		const removeOptions = listenerOptions.capture
			? { capture: true }
			: undefined;
		let off;
		const listener =
			listenerOptions.once && signal
				? (e) => {
						signal.removeEventListener("abort", off);
						fn.call(target, e);
					}
				: fn;
		off = () => {
			target.removeEventListener(event, listener, removeOptions);
			signal?.removeEventListener("abort", off);
		};
		if (hasOptions) target.addEventListener(event, listener, listenerOptions);
		else target.addEventListener(event, listener);
		signal?.addEventListener("abort", off, { once: true });
		return off;
	}

	static emit(el, event, detail) {
		const target = typeof el === "string" ? document.querySelector(el) : el;
		const customEvent = new CustomEvent(event, {
			bubbles: true,
			cancelable: true,
			detail,
		});
		target.dispatchEvent(customEvent);
	}
}
