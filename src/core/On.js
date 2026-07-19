export default class On {
	static on(parent, event, selector, fn) {
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
