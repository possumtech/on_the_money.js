export default class On {
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

		const handler = (e) => {
			const target = e.target.closest(selector);
			if (target && container.contains(target)) {
				fn.call(target, e, target);
			}
		};
		container.addEventListener(event, handler);
		return () => container.removeEventListener(event, handler);
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
