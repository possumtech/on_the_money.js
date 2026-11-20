import The from "./The.js";

const DATA_ATTR_RE = /^data-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

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
	static clone(parent, selector, { position = "beforeend" } = {}) {
		const container =
			typeof parent === "string" ? document.querySelector(parent) : parent;
		const template = document.querySelector(selector);

		if (!container) throw new Error(`Parent not found: ${parent}`);
		if (!template) throw new Error(`Template not found: ${selector}`);

		const el = template.content.cloneNode(true).firstElementChild;

		The._t(el);

		container.insertAdjacentElement(position, el);

		const event = new CustomEvent("mounted", {
			bubbles: true,
			detail: { parent: container },
		});
		el.dispatchEvent(event);

		return el;
	}

	// List rendering: clear + clone-per-item + fill, replace-children
	// semantics only. Use $.reconcile() when existing items must keep
	// DOM identity, focus, selection, or transient control state.
	static cloneEach(parent, selector, items, fill) {
		const container =
			typeof parent === "string" ? document.querySelector(parent) : parent;
		if (!container) throw new Error(`Parent not found: ${parent}`);
		container.replaceChildren();
		const mounted = [];
		let i = 0;
		for (const item of items) {
			const el = Select.clone(container, selector);
			fill?.(el, item, i++);
			mounted.push(el);
		}
		return mounted;
	}

	// Imperative, stateless keyed list reconciliation. The DOM attribute (`attr`)
	// is the key index — no reactive proxies or shadow VDOM. Prefers native
	// Element.prototype.moveBefore so focus, selection, <textarea> edits, and
	// <details open> survive reorderings.
	static reconcile(
		parent,
		selector,
		items,
		{ key, fill, attr = "data-otm-key" } = {},
	) {
		const container =
			typeof parent === "string" ? document.querySelector(parent) : parent;
		if (!container) throw new Error(`Parent not found: ${parent}`);
		if (typeof key !== "function") {
			throw new TypeError("$.reconcile(): options.key must be a function");
		}
		if (typeof attr !== "string" || !DATA_ATTR_RE.test(attr)) {
			throw new TypeError(
				`$.reconcile(): options.attr must be a canonical data-* attribute, got ${JSON.stringify(attr)}`,
			);
		}

		// Validate all keys up front so duplicate/invalid keys never leave partial DOM mutations.
		const planned = [];
		const seen = new Set();
		let index = 0;
		for (const item of items) {
			const rawKey = key(item, index);
			if (rawKey === null || rawKey === undefined || String(rawKey) === "") {
				throw new TypeError("$.reconcile(): key() must return a non-empty key");
			}
			const k = String(rawKey);
			if (seen.has(k)) {
				throw new RangeError(
					`$.reconcile(): duplicate key ${JSON.stringify(k)}`,
				);
			}
			seen.add(k);
			planned.push({ key: k, item, index: index++ });
		}

		const existing = new Map();
		for (const child of Array.from(container.children)) {
			const k = child.getAttribute(attr);
			if (k !== null && !existing.has(k)) existing.set(k, child);
		}

		const next = [];
		const keep = new Set();
		for (const entry of planned) {
			let el = existing.get(entry.key);
			if (!el) {
				el = Select.clone(container, selector);
				el.setAttribute(attr, entry.key);
			}
			keep.add(el);
			next.push({ ...entry, el });
		}

		const active =
			typeof document !== "undefined" ? document.activeElement : null;
		const focused =
			active && container.contains(active) && typeof active.focus === "function"
				? active
				: null;

		for (const child of Array.from(container.children)) {
			if (!keep.has(child)) child.remove();
		}

		const move =
			typeof container.moveBefore === "function"
				? (node, ref) => container.moveBefore(node, ref)
				: (node, ref) => container.insertBefore(node, ref);

		for (let i = 0; i < next.length; i++) {
			const { el } = next[i];
			const current = container.children[i] ?? null;
			if (current !== el) move(el, current);
		}

		// Restore focus if a surviving node lost it during reorder (e.g. WebKit
		// insertBefore fallback or Gecko's moveBefore bug on <textarea>).
		if (
			focused &&
			container.contains(focused) &&
			document.activeElement !== focused
		) {
			focused.focus({ preventScroll: true });
		}

		const mounted = [];
		for (const { el, item, index: idx } of next) {
			fill?.(el, item, idx);
			mounted.push(el);
		}
		return mounted;
	}
}
