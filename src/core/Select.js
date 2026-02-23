export default class Select {
	static $(context, selector) {
		if (typeof context === "string") {
			selector = context;
			context = document;
		}
		return context.querySelector(selector);
	}

	static $$(context, selector) {
		if (typeof context === "string") {
			selector = context;
			context = document;
		}
		return Array.from(context.querySelectorAll(selector));
	}

	static clone(selector) {
		const template = document.querySelector(selector);
		if (!template) throw new Error(`Template not found: ${selector}`);
		return template.content.cloneNode(true).firstElementChild;
	}
}
