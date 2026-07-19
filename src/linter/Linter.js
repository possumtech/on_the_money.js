import * as parse5 from "parse5";

export default class Linter {
	static check(file, source, availableLocales = null) {
		if (!file.endsWith(".html")) return [];
		const violations = [];
		const document = parse5.parse(source, { sourceCodeLocationInfo: true });
		Linter.#checkHtmlRules(document, violations, file, availableLocales);
		return violations;
	}

	static #checkHtmlRules(document, violations, file, availableLocales) {
		let hasI18nMeta = false;
		let manifestMatches = true;
		let usesI18n = false;
		let isFullDocument = false;

		Linter.#traverse(document, (node) => {
			if (
				(node.nodeName === "html" || node.nodeName === "#documentType") &&
				node.sourceCodeLocation
			) {
				isFullDocument = true;
			}

			const attrs = node.attrs
				? Object.fromEntries(node.attrs.map((a) => [a.name, a.value]))
				: {};

			if (node.nodeName === "meta" && attrs.name === "i18n") {
				hasI18nMeta = true;
				if (availableLocales) {
					const manifest = (attrs["data-available"] || "")
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean);
					if (
						manifest.length !== availableLocales.length ||
						!availableLocales.every((l) => manifest.includes(l))
					) {
						manifestMatches = false;
					}
				}
			}
			if (attrs["data-i18n"]) usesI18n = true;

			if (attrs["data-action"]) {
				const interactiveTags = [
					"button",
					"a",
					"input",
					"select",
					"textarea",
					"form",
				];
				const isSemantic = interactiveTags.includes(node.nodeName);
				const hasA11y = attrs.role && attrs.tabindex !== undefined;

				if (!isSemantic && !hasA11y) {
					const loc = node.sourceCodeLocation?.attrs?.["data-action"] ||
						node.sourceCodeLocation || { startLine: 1, startCol: 1 };
					Linter.#addViolation(
						violations,
						file,
						{ line: loc.startLine, column: loc.startCol },
						"HTML-017",
						"Non-semantic interactive element. Use a <button> or add role and tabindex.",
					);
				}
			}

			if (node.nodeName === "#text") {
				const parent = node.parentNode;
				const parentName = parent?.nodeName;
				const hasCarrier = parent?.attrs?.some(
					(a) => a.name === "data-i18n" || a.name === "data-text",
				);
				const leafTextParents = new Set([
					"script",
					"style",
					"option",
					"textarea",
					"title",
				]);

				if (
					!leafTextParents.has(parentName) &&
					node.value.trim() !== "" &&
					!hasCarrier
				) {
					const loc = node.sourceCodeLocation || { startLine: 1, startCol: 1 };
					Linter.#addViolation(
						violations,
						file,
						{ line: loc.startLine, column: loc.startCol },
						"HTML-004",
						'Naked text is forbidden. Give the enclosing element data-i18n="key" (localizable copy) or data-text="key" (state-projected content), keeping this text in place as the source-language fallback.',
					);
				}
			}
		});

		if (isFullDocument && usesI18n) {
			if (!hasI18nMeta) {
				Linter.#addViolation(
					violations,
					file,
					{ line: 1, column: 1 },
					"HTML-023",
					'Localization detected, but missing <meta name=\'i18n\' ...>. Add <meta name="i18n" content="/locales" data-available="en" data-fallback="en"> to <head>.',
				);
			} else if (!manifestMatches) {
				Linter.#addViolation(
					violations,
					file,
					{ line: 1, column: 1 },
					"HTML-024",
					"The data-available attribute on <meta name='i18n'> does not match the locales folder. Update data-available to list exactly the locale .json files present.",
				);
			}
		}
	}

	static crossCheck({ htmlSources, jsSources, cssSources = [] }) {
		const violations = [];

		// HTML-101: orphan templates — <template id="X"> never referenced by $.clone(_, "#X")
		const templates = new Map();
		for (const { file, source } of htmlSources) {
			const document = parse5.parse(source, { sourceCodeLocationInfo: true });
			Linter.#traverse(document, (node) => {
				if (node.nodeName === "template") {
					const idAttr = node.attrs?.find((a) => a.name === "id");
					const dynamic = node.attrs?.some(
						(a) => a.name === "data-otm-dynamic",
					);
					if (dynamic) return;
					if (idAttr?.value) {
						const loc = node.sourceCodeLocation || {
							startLine: 1,
							startCol: 1,
						};
						templates.set(idAttr.value, {
							file,
							line: loc.startLine,
							column: loc.startCol,
						});
					}
				}
			});
		}

		const cloneRefs = new Set();
		for (const { source } of jsSources) {
			const matches = source.matchAll(
				/\$\.clone(?:Each)?\s*\([^,)]+,\s*['"]#([^'"]+)['"]/g,
			);
			for (const m of matches) cloneRefs.add(m[1]);
		}

		for (const [id, info] of templates) {
			if (!cloneRefs.has(id)) {
				Linter.#addViolation(
					violations,
					info.file,
					{ line: info.line, column: info.column },
					"HTML-101",
					`Orphan template: <template id="${id}"> is never referenced by $.clone(). Remove the template or add a clone call.`,
				);
			}
		}

		// HTML-102: data-i18n keys missing from the html file's own locale dictionaries
		// HTML-103: data-i18n-{var} attrs reference template tokens that don't exist in the dictionary entry
		for (const { file, source, dicts } of htmlSources) {
			if (!dicts || dicts.length === 0) continue;

			const document = parse5.parse(source, { sourceCodeLocationInfo: true });
			Linter.#traverse(document, (node) => {
				const attrs = node.attrs
					? Object.fromEntries(node.attrs.map((a) => [a.name, a.value]))
					: {};
				if (!attrs["data-i18n"]) return;

				const key = attrs["data-i18n"];
				const params = [];
				for (const attr of node.attrs) {
					if (
						attr.name.startsWith("data-i18n-") &&
						attr.name !== "data-i18n-type"
					) {
						params.push(attr.name.replace("data-i18n-", ""));
					}
				}
				const loc = node.sourceCodeLocation?.attrs?.["data-i18n"] ||
					node.sourceCodeLocation || { startLine: 1, startCol: 1 };
				const where = { line: loc.startLine, column: loc.startCol };

				const foundIn = dicts.filter((d) => key in d.dict);
				if (foundIn.length === 0) {
					Linter.#addViolation(
						violations,
						file,
						where,
						"HTML-102",
						`i18n key "${key}" is not declared in any locale dictionary (${dicts.map((d) => d.locale).join(", ")}).`,
					);
					return;
				}

				for (const { locale, dict } of foundIn) {
					const entry = dict[key];
					let template;
					if (typeof entry === "string") template = entry;
					else if (typeof entry === "object" && entry !== null) {
						template = entry.other || entry.one || Object.values(entry)[0];
					}
					if (typeof template !== "string") continue;

					const tokens = new Set();
					for (const m of template.matchAll(/\{([^}]+)\}/g)) tokens.add(m[1]);

					for (const param of params) {
						if (!tokens.has(param)) {
							Linter.#addViolation(
								violations,
								file,
								where,
								"HTML-103",
								`data-i18n-${param} has no matching {${param}} token in dictionary entry "${key}" (locale "${locale}").`,
							);
						}
					}
				}
			});
		}

		// HTML-104: keys written globally in JS that also appear as data-text
		// slots inside <template> subtrees — global writes walk the whole
		// document and clobber every instance.
		const globalWriteKeys = Linter.#globalWriteKeys(jsSources);

		for (const { file, source } of htmlSources) {
			const document = parse5.parse(source, { sourceCodeLocationInfo: true });
			Linter.#traverse(document, (node) => {
				if (node.nodeName !== "template") return;
				Linter.#traverse(node, (inner) => {
					const slotKeys = [];
					const dt = inner.attrs?.find((a) => a.name === "data-text");
					if (dt?.value) slotKeys.push({ attr: "data-text", key: dt.value });
					const db = inner.attrs?.find((a) => a.name === "data-bind");
					for (const pair of db?.value?.split(/\s+/) ?? []) {
						const i = pair.indexOf(":");
						if (i >= 1)
							slotKeys.push({ attr: "data-bind", key: pair.slice(i + 1) });
					}
					for (const { attr, key } of slotKeys) {
						const writer = globalWriteKeys.get(key);
						if (!writer) continue;
						const loc = inner.sourceCodeLocation || {
							startLine: 1,
							startCol: 1,
						};
						Linter.#addViolation(
							violations,
							file,
							{ line: loc.startLine, column: loc.startCol },
							"HTML-104",
							`Scoped slot ${attr} key "${key}" inside a <template> collides with the global the("${key}", ...) write in ${writer.file}:${writer.line} — the global write will clobber every cloned instance. Rename the template slot key or the global key.`,
						);
					}
				});
			});
		}

		// HTML-105: data-action values in HTML ↔ [data-action="..."] selector
		// literals in JS, both directions. A generic [data-action] selector in
		// JS (action-dispatch pattern) waives the dead-control direction.
		const actionRefs = new Map();
		let wildcardDispatch = false;
		for (const { file, source } of jsSources) {
			if (/\[data-action\]/.test(source)) wildcardDispatch = true;
			for (const m of source.matchAll(/\[data-action=["']?([\w-]+)["']?\]/g)) {
				if (!actionRefs.has(m[1]))
					actionRefs.set(m[1], { file, line: Linter.#lineOf(source, m.index) });
			}
		}

		const actionValues = new Set();
		for (const { file, source } of htmlSources) {
			const document = parse5.parse(source, { sourceCodeLocationInfo: true });
			Linter.#traverse(document, (node) => {
				const action = node.attrs?.find((a) => a.name === "data-action");
				if (!action?.value) return;
				actionValues.add(action.value);
				const dynamic = node.attrs?.some((a) => a.name === "data-otm-dynamic");
				if (dynamic || wildcardDispatch || actionRefs.has(action.value)) return;
				const loc = node.sourceCodeLocation?.attrs?.["data-action"] ||
					node.sourceCodeLocation || { startLine: 1, startCol: 1 };
				Linter.#addViolation(
					violations,
					file,
					{ line: loc.startLine, column: loc.startCol },
					"HTML-105",
					`data-action="${action.value}" has no on() handler referencing [data-action="${action.value}"] in any scanned .js file — dead control. Add the handler, fix the typo, or mark the element data-otm-dynamic.`,
				);
			});
		}

		for (const [value, ref] of actionRefs) {
			if (actionValues.has(value)) continue;
			Linter.#addViolation(
				violations,
				ref.file,
				{ line: ref.line, column: 1 },
				"HTML-105",
				`on() selector [data-action="${value}"] matches no element in any scanned .html file — orphan handler. Add the control or fix the typo.`,
			);
		}

		// HTML-106 (warn): the deletion test — a globally written key nothing
		// consumes (CSS attribute selector, [data-text] slot, or a JS
		// "data-key" string literal e.g. MutationObserver attributeFilter)
		// is dead state or a missing CSS rule.
		const consumed = new Set();
		for (const { source } of cssSources) {
			for (const m of source.matchAll(/\[data-([a-z0-9-]+)/g))
				consumed.add(m[1]);
		}
		for (const { source } of htmlSources) {
			// Inline <style> blocks ride along in the raw HTML source.
			for (const m of source.matchAll(/\[data-([a-z0-9-]+)/g))
				consumed.add(m[1]);
			for (const m of source.matchAll(/data-text=["']([\w-]+)["']/g))
				consumed.add(m[1]);
			for (const m of source.matchAll(/data-bind=["']([^"']+)["']/g)) {
				for (const pair of m[1].split(/\s+/)) {
					const i = pair.indexOf(":");
					if (i >= 1) consumed.add(pair.slice(i + 1));
				}
			}
		}
		for (const { source } of jsSources) {
			for (const m of source.matchAll(/["']data-([a-z0-9-]+)["']/g))
				consumed.add(m[1]);
			for (const m of source.matchAll(/\bthe\s*\(\s*["']([^"']+)["']\s*\)/g))
				consumed.add(Linter.#kebab(m[1]));
		}

		for (const [key, writer] of globalWriteKeys) {
			if (consumed.has(key)) continue;
			Linter.#addViolation(
				violations,
				writer.file,
				{ line: writer.line, column: 1 },
				"HTML-106",
				`State key "${key}" is written via the() but never consumed by a CSS attribute selector, a [data-text] slot, or a JS data-attribute reference — dead state or a missing CSS rule (the deletion test).`,
				"warn",
			);
		}

		return violations;
	}

	// Mirrors The.#kebab — lint-time keys must match runtime attribute names.
	static #kebab(key) {
		return key
			.replace(/_/g, "-")
			.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
			.toLowerCase();
	}

	static #lineOf(source, index) {
		return source.slice(0, index).split("\n").length;
	}

	// Global the() writes: the("key", ...) and the({ key: ... }) literals.
	// Scoped writes (the(el, ...)) never match — first arg isn't a string.
	static #globalWriteKeys(jsSources) {
		const keys = new Map();
		for (const { file, source } of jsSources) {
			for (const m of source.matchAll(/\bthe\s*\(\s*["']([^"']+)["']\s*,/g)) {
				const k = Linter.#kebab(m[1]);
				if (!keys.has(k))
					keys.set(k, { file, line: Linter.#lineOf(source, m.index) });
			}
			for (const m of source.matchAll(/\bthe\s*\(\s*\{([^}]*)\}/g)) {
				for (const km of m[1].matchAll(
					/(?:^|[,{\s])["']?([A-Za-z_$][\w$]*)["']?\s*:/g,
				)) {
					const k = Linter.#kebab(km[1]);
					if (!keys.has(k))
						keys.set(k, { file, line: Linter.#lineOf(source, m.index) });
				}
			}
		}
		return keys;
	}

	static #traverse(node, visitor) {
		visitor(node);
		// parse5 templates keep children under content.childNodes while
		// childNodes stays a truthy empty array — walk both.
		for (const child of node.childNodes || []) Linter.#traverse(child, visitor);
		for (const child of node.content?.childNodes || [])
			Linter.#traverse(child, visitor);
	}

	static #addViolation(violations, file, loc, ruleId, message, severity) {
		violations.push({
			file,
			ruleId,
			line: loc.line || loc.startLine,
			column: loc.column || loc.startCol,
			message,
			...(severity ? { severity } : {}),
		});
	}
}
