import On from "../core/On.js";

// WAI-ARIA APG Combobox Pattern controller — DOM-native behavior battery.
// Owns: aria-expanded, aria-activedescendant, data-active (CSS highlight hook),
// aria-selected, APG keyboard navigation (editable <input> and select-only
// comboboxes), pointer focus preservation, outside-click/blur dismissal,
// optional native [popover="manual"] top-layer toggling, and sync() after
// external DOM updates.
//
// NOT in scope: data fetching, caching, query debouncing, client filtering,
// option rendering/templates (compose with SSR, $.cloneEach, or $.reconcile),
// JS positioning engines, virtual scrolling, or multi-select tag pills.
export default class Combobox {
	#input;
	#listbox;
	#options;
	#isEditable;
	#wrap;
	#openOnFocus;
	#clearOnEscape;
	#closeOnSelect;
	#expanded = false;
	#active = null;
	#disposed = false;
	#clearing = false;
	#idSeq = 0;
	#unsubs = [];

	constructor(target, options = {}) {
		const input =
			typeof target === "string" ? document.querySelector(target) : target;
		if (!input || !(input instanceof Element)) {
			throw new TypeError(`combobox(): target element not found: ${target}`);
		}
		if (input.getAttribute("role") !== "combobox") {
			throw new TypeError(
				'combobox(): target element must carry role="combobox"',
			);
		}
		const controlsId = input.getAttribute("aria-controls")?.trim();
		if (!controlsId) {
			throw new TypeError(
				'combobox(): target element requires aria-controls referencing a [role="listbox"] id',
			);
		}
		const listbox = document.getElementById(controlsId);
		if (listbox?.getAttribute("role") !== "listbox") {
			throw new TypeError(
				`combobox(): aria-controls="${controlsId}" must reference an existing [role="listbox"] element`,
			);
		}
		if (listbox.hasAttribute("popover")) {
			const mode = listbox.getAttribute("popover").trim().toLowerCase();
			if (mode !== "manual") {
				throw new TypeError(
					`combobox(): popover listbox #${controlsId} must use popover="manual" so native light-dismiss does not conflict with combobox focus and Escape handling`,
				);
			}
		}

		this.#input = input;
		this.#listbox = listbox;
		this.#options = options;
		const tag = input.tagName.toUpperCase();
		this.#isEditable =
			tag === "INPUT" || tag === "TEXTAREA" || Boolean(input.isContentEditable);
		this.#wrap = options.wrap ?? true;
		this.#openOnFocus = options.openOnFocus ?? true;
		this.#clearOnEscape = options.clearOnEscape ?? true;
		this.#closeOnSelect = options.closeOnSelect ?? true;

		if (options.signal?.aborted) {
			this.#disposed = true;
			return;
		}

		this.#expanded = input.getAttribute("aria-expanded") === "true";
		Combobox.#setAttr(
			input,
			"aria-expanded",
			this.#expanded ? "true" : "false",
		);
		this.#syncVisibility();

		if (options.signal) {
			this.#unsubs.push(
				On.target(options.signal, "abort", () => this.dispose(), {
					once: true,
				}),
			);
		}

		this.#unsubs.push(
			On.on(input, "keydown", '[role="combobox"]', (e) => this.#onKeydown(e)),
			On.on(input, "focus", '[role="combobox"]', () => {
				if (this.#openOnFocus) this.open();
			}),
			On.on(input, "click", '[role="combobox"]', () => {
				if (this.#isEditable) {
					if (this.#openOnFocus && !this.#expanded) this.open();
				} else if (this.#expanded) {
					this.close();
				} else {
					this.open();
				}
			}),
			On.on(input, "blur", '[role="combobox"]', (e) => {
				const next = e.relatedTarget;
				if (
					next &&
					(this.#input.contains(next) || this.#listbox.contains(next))
				) {
					return;
				}
				this.close();
			}),
			On.on(listbox, "mousedown", "*", (e) => {
				// Keep DOM focus on the combobox while interacting with listbox options or scrollbar.
				e.preventDefault();
			}),
			On.on(listbox, "click", '[role="option"]', (_e, option) => {
				if (!this.#isOptionAvailable(option)) return;
				this.select(option);
				if (this.#isEditable && document.activeElement !== this.#input) {
					this.#input.focus?.({ preventScroll: true });
				}
			}),
			On.target(document, "mousedown", (e) => {
				if (!this.#expanded) return;
				const raw = e.target;
				if (
					raw &&
					typeof Node !== "undefined" &&
					raw instanceof Node &&
					(this.#input.contains(raw) || this.#listbox.contains(raw))
				) {
					return;
				}
				this.close();
			}),
		);

		if (this.#isEditable) {
			this.#unsubs.push(
				On.on(input, "input", '[role="combobox"]', () => {
					if (this.#clearing) return;
					this.#setActive(null);
					if (!this.#expanded) this.open();
					else this.sync();
				}),
			);
		}

		if (this.#expanded) this.sync();
	}

	get input() {
		return this.#input;
	}

	get listbox() {
		return this.#listbox;
	}

	get expanded() {
		return this.#expanded;
	}

	get activeOption() {
		return this.#active;
	}

	open() {
		if (this.#disposed || this.#expanded) return;
		this.#expanded = true;
		Combobox.#setAttr(this.#input, "aria-expanded", "true");
		this.#syncVisibility();
		this.sync();
		this.#options.onOpen?.(this.#input, this.#listbox);
	}

	close() {
		if (this.#disposed || !this.#expanded) return;
		this.#expanded = false;
		this.#setActive(null);
		Combobox.#setAttr(this.#input, "aria-expanded", "false");
		this.#syncVisibility();
		this.#options.onClose?.(this.#input, this.#listbox);
	}

	sync() {
		if (this.#disposed) return;
		for (const opt of this.#availableOptions()) {
			this.#ensureOptionId(opt);
		}
		if (this.#active && !this.#isOptionAvailable(this.#active)) {
			this.#setActive(null);
		}
	}

	select(option) {
		if (this.#disposed) return;
		if (
			!(option instanceof Element) ||
			!this.#listbox.contains(option) ||
			option.getAttribute("role") !== "option"
		) {
			throw new TypeError(
				'combobox.select(): expected a [role="option"] element inside the controlled listbox',
			);
		}
		if (!this.#isOptionAvailable(option)) return;
		for (const opt of this.#listbox.querySelectorAll('[role="option"]')) {
			if (opt === option) {
				Combobox.#setAttr(opt, "aria-selected", "true");
			} else if (opt.getAttribute("aria-selected") === "true") {
				Combobox.#setAttr(opt, "aria-selected", "false");
			}
		}
		if (this.#closeOnSelect) this.close();
		this.#options.onSelect?.(option, this.#input);
	}

	dispose() {
		if (this.#disposed) return;
		this.#disposed = true;
		this.#setActive(null);
		for (const off of this.#unsubs) off();
		this.#unsubs = [];
	}

	#onKeydown(e) {
		if (e.isComposing || e.ctrlKey || e.metaKey) return;

		switch (e.key) {
			case "ArrowDown": {
				e.preventDefault();
				if (!this.#expanded) {
					this.open();
					if (!e.altKey) this.#move(1);
				} else {
					this.#move(1);
				}
				return;
			}
			case "ArrowUp": {
				e.preventDefault();
				if (e.altKey && this.#expanded) {
					this.close();
					return;
				}
				if (!this.#expanded) {
					this.open();
				}
				this.#move(-1);
				return;
			}
			case "Home": {
				if (this.#isEditable) {
					// Preserve native textbox caret jump; return visual focus to textbox per APG.
					this.#setActive(null);
				} else if (this.#expanded) {
					e.preventDefault();
					this.#moveBoundary(true);
				}
				return;
			}
			case "End": {
				if (this.#isEditable) {
					this.#setActive(null);
				} else if (this.#expanded) {
					e.preventDefault();
					this.#moveBoundary(false);
				}
				return;
			}
			case "ArrowLeft":
			case "ArrowRight": {
				if (this.#isEditable && this.#active) {
					this.#setActive(null);
				}
				return;
			}
			case "Enter": {
				if (
					this.#expanded &&
					this.#active &&
					this.#isOptionAvailable(this.#active)
				) {
					e.preventDefault();
					this.select(this.#active);
				} else if (!this.#isEditable && !this.#expanded) {
					e.preventDefault();
					this.open();
				}
				return;
			}
			case " ": {
				if (this.#isEditable) return;
				e.preventDefault();
				if (!this.#expanded) {
					this.open();
				} else if (this.#active && this.#isOptionAvailable(this.#active)) {
					this.select(this.#active);
				}
				return;
			}
			case "Escape": {
				if (this.#expanded) {
					e.preventDefault();
					this.close();
				} else if (
					this.#isEditable &&
					this.#clearOnEscape &&
					"value" in this.#input &&
					this.#input.value
				) {
					e.preventDefault();
					this.#input.value = "";
					this.#clearing = true;
					try {
						const EventCtor =
							this.#input.ownerDocument?.defaultView?.Event || Event;
						this.#input.dispatchEvent(
							new EventCtor("input", { bubbles: true }),
						);
					} finally {
						this.#clearing = false;
					}
				}
				return;
			}
			case "Tab": {
				if (this.#expanded) this.close();
				return;
			}
		}
	}

	#move(delta) {
		const opts = this.#availableOptions();
		if (opts.length === 0) {
			this.#setActive(null);
			return;
		}
		const idx = this.#active ? opts.indexOf(this.#active) : -1;
		let nextIdx;
		if (idx === -1) {
			nextIdx = delta > 0 ? 0 : opts.length - 1;
		} else if (this.#wrap) {
			nextIdx = (idx + delta + opts.length) % opts.length;
		} else {
			nextIdx = Math.max(0, Math.min(opts.length - 1, idx + delta));
		}
		this.#setActive(opts[nextIdx]);
	}

	#moveBoundary(first) {
		const opts = this.#availableOptions();
		if (opts.length === 0) {
			this.#setActive(null);
			return;
		}
		this.#setActive(first ? opts[0] : opts[opts.length - 1]);
	}

	#setActive(opt) {
		if (opt === this.#active) {
			if (opt) {
				const id = this.#ensureOptionId(opt);
				Combobox.#setAttr(this.#input, "aria-activedescendant", id);
				Combobox.#setAttr(opt, "data-active", "true");
			}
			return;
		}
		if (this.#active) {
			this.#active.removeAttribute("data-active");
		}
		this.#active = opt;
		if (opt) {
			const id = this.#ensureOptionId(opt);
			Combobox.#setAttr(this.#input, "aria-activedescendant", id);
			Combobox.#setAttr(opt, "data-active", "true");
			opt.scrollIntoView?.({ block: "nearest" });
		} else {
			this.#input.removeAttribute("aria-activedescendant");
		}
	}

	#availableOptions() {
		return Array.from(this.#listbox.querySelectorAll('[role="option"]')).filter(
			(opt) => this.#isOptionAvailable(opt),
		);
	}

	#isOptionAvailable(opt) {
		if (
			!opt ||
			!this.#listbox.contains(opt) ||
			opt.hidden ||
			opt.getAttribute("aria-disabled") === "true"
		) {
			return false;
		}
		let cur = opt.parentElement;
		while (cur && cur !== this.#listbox) {
			if (cur.hidden) return false;
			cur = cur.parentElement;
		}
		return true;
	}

	#ensureOptionId(opt) {
		if (!opt.id) {
			const prefix = this.#listbox.id;
			let candidate;
			do {
				candidate = `${prefix}-opt-${++this.#idSeq}`;
			} while (document.getElementById(candidate));
			opt.id = candidate;
		}
		return opt.id;
	}

	#usesPopover() {
		return this.#listbox.hasAttribute("popover");
	}

	#isPopoverOpen() {
		try {
			return this.#listbox.matches(":popover-open");
		} catch {
			return false;
		}
	}

	#syncVisibility() {
		if (this.#usesPopover()) {
			if (!this.#listbox.isConnected) return;
			if (this.#expanded) {
				if (
					typeof this.#listbox.showPopover === "function" &&
					!this.#isPopoverOpen()
				) {
					this.#listbox.showPopover();
				}
			} else if (
				typeof this.#listbox.hidePopover === "function" &&
				this.#isPopoverOpen()
			) {
				this.#listbox.hidePopover();
			}
			return;
		}
		const shouldHide = !this.#expanded;
		if (this.#listbox.hidden !== shouldHide) {
			this.#listbox.hidden = shouldHide;
		}
	}

	static #setAttr(el, name, value) {
		if (el.getAttribute(name) !== value) {
			el.setAttribute(name, value);
		}
	}
}
