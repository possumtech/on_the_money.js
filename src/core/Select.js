import The from "./The.js";

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
		const el = template.content.cloneNode(true).firstElementChild;
		// Surgical hydration of the new fragment
		The._t(el);
		return el;
	}
}
