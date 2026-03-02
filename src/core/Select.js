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

	/**
	 * Clones a template and attaches it to a parent.
	 * This ensures the element is immediately part of the DOM lifecycle.
	 * @param {HTMLElement|string} parent - The target container
	 * @param {string} selector - The template ID/selector
	 * @returns {HTMLElement} The mounted element
	 */
	static clone(parent, selector) {
		const container =
			typeof parent === "string" ? document.querySelector(parent) : parent;
		const template = document.querySelector(selector);

		if (!container) throw new Error(`Parent not found: ${parent}`);
		if (!template) throw new Error(`Template not found: ${selector}`);

		const el = template.content.cloneNode(true).firstElementChild;

		// Surgical hydration of the new fragment before mounting
		The._t(el);

		container.appendChild(el);

		// Trigger a 'mounted' custom event for lifecycle hooks
		const event = new CustomEvent("mounted", {
			bubbles: true,
			detail: { parent: container },
		});
		el.dispatchEvent(event);

		return el;
	}
}
