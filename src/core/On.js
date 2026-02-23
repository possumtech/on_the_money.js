export default class On {
	static on(parent, event, selector, fn) {
		const container =
			typeof parent === "string"
				? document.querySelector(parent)
				: parent || document.body;

		container.addEventListener(event, (e) => {
			const target = e.target.closest(selector);
			if (target && container.contains(target)) {
				fn.call(target, e, target);
			}
		});
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
