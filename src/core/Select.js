export default class Select {
	static $(context, selector) {
		let ctx = context;
		let sel = selector;
		if (typeof ctx === "string") {
			sel = ctx;
			ctx = document;
		}
		return ctx.querySelector(sel);
	}

	static $$(context, selector) {
		let ctx = context;
		let sel = selector;
		if (typeof ctx === "string") {
			sel = ctx;
			ctx = document;
		}
		return Array.from(ctx.querySelectorAll(sel));
	}

	static clone(selector) {
		const template = document.querySelector(selector);
		if (!template) throw new Error(`Template not found: ${selector}`);
		return template.content.cloneNode(true).firstElementChild;
	}
}
