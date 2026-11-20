const assign = (obj, key, value) => {
	// name="tags[]" is an array from the first entry — shape must not
	// depend on cardinality.
	const isArrayLeaf = key.endsWith("[]");
	const parts = key.split(/[[\]]/).filter(Boolean);
	const forbidden = parts.find((part) =>
		["__proto__", "prototype", "constructor"].includes(part),
	);
	if (forbidden) {
		throw new TypeError(
			`the.form: unsafe field name ${JSON.stringify(key)} contains forbidden path segment ${JSON.stringify(forbidden)}`,
		);
	}
	let current = obj;
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const isLast = i === parts.length - 1;
		if (isLast) {
			if (isArrayLeaf) {
				current[part] ||= [];
				current[part].push(value);
			} else if (current[part] !== undefined) {
				if (!Array.isArray(current[part])) current[part] = [current[part]];
				current[part].push(value);
			} else {
				current[part] = value;
			}
		} else {
			current[part] = current[part] || {};
			current = current[part];
		}
	}
};

export function flat(obj, sep = "-") {
	if (obj === null || typeof obj !== "object") {
		throw new TypeError("the.flat: input must be an object");
	}
	const out = {};
	const walk = (val, prefix) => {
		if (val === null || typeof val !== "object") {
			out[prefix] = val;
			return;
		}
		for (const [k, v] of Object.entries(val)) {
			walk(v, prefix ? `${prefix}${sep}${k}` : k);
		}
	};
	walk(obj, "");
	return out;
}

export function extractForm(formEl) {
	const obj = {};
	const controls = formEl.querySelectorAll("input, select, textarea");

	for (const el of controls) {
		const name = el.name;
		if (!name || el.disabled) continue;

		const type = (el.type || "text").toLowerCase();
		if (type === "submit" || type === "button" || type === "reset") continue;
		if (type === "file") continue;

		if (type === "checkbox" || type === "radio") {
			const checked = el.checked ?? el.hasAttribute("checked");
			if (!checked) continue;
		}

		if (el.tagName === "SELECT" && el.hasAttribute("multiple")) {
			// selectedOptions in browsers; attribute query under linkedom (tests).
			const opts =
				"selectedOptions" in el
					? el.selectedOptions
					: el.querySelectorAll("option[selected]");
			for (const opt of opts) assign(obj, name, opt.value);
			continue;
		}

		const value = el.value ?? el.getAttribute("value") ?? "";
		assign(obj, name, value);
	}
	return obj;
}
