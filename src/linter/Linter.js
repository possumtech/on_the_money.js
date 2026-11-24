import Markup from "./Markup.js";

const EXTERNAL_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const TEMPLATE_EXPR_RE = /\{\{|\$\{|\s/;

const blankPreservingNewlines = (text) => text.replace(/[^\r\n]/g, " ");

const stripCssComments = (source) => {
	let out = "";
	let i = 0;
	const len = source.length;
	while (i < len) {
		const ch = source[i];
		if (ch === '"' || ch === "'") {
			const start = i++;
			while (i < len) {
				if (source[i] === "\\") i += 2;
				else if (source[i++] === ch) break;
			}
			out += source.slice(start, i);
			continue;
		}
		if (ch === "/" && source[i + 1] === "*") {
			const end = source.indexOf("*/", i + 2);
			const close = end === -1 ? len : end + 2;
			out += blankPreservingNewlines(source.slice(i, close));
			i = close;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
};

const stripJsComments = (source) => {
	let out = "";
	let i = 0;
	const len = source.length;
	while (i < len) {
		const ch = source[i];
		if (ch === '"' || ch === "'" || ch === "`") {
			const start = i++;
			while (i < len) {
				if (source[i] === "\\") i += 2;
				else if (source[i++] === ch) break;
			}
			out += source.slice(start, i);
			continue;
		}
		if (ch === "/" && source[i + 1] === "/") {
			const nl = source.indexOf("\n", i + 2);
			const end = nl === -1 ? len : nl;
			out += blankPreservingNewlines(source.slice(i, end));
			i = end;
			continue;
		}
		if (ch === "/" && source[i + 1] === "*") {
			const end = source.indexOf("*/", i + 2);
			const close = end === -1 ? len : end + 2;
			out += blankPreservingNewlines(source.slice(i, close));
			i = close;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
};

const extractTopLevelObjectKeys = (source, openBraceIndex) => {
	const keys = [];
	const len = source.length;
	let depth = 0;
	let parenDepth = 0;
	let bracketDepth = 0;
	let i = openBraceIndex;
	let expectKey = true;

	while (i < len) {
		const ch = source[i];
		if (ch === '"' || ch === "'" || ch === "`") {
			const start = i++;
			while (i < len) {
				if (source[i] === "\\") i += 2;
				else if (source[i++] === ch) break;
			}
			if (
				depth === 1 &&
				parenDepth === 0 &&
				bracketDepth === 0 &&
				expectKey &&
				ch !== "`"
			) {
				let j = i;
				while (j < len && /\s/.test(source[j])) j++;
				if (source[j] === ":") {
					keys.push(source.slice(start + 1, i - 1));
					expectKey = false;
				}
			}
			continue;
		}
		if (ch === "{") {
			depth++;
			if (depth === 1) expectKey = true;
			i++;
			continue;
		}
		if (ch === "}") {
			depth--;
			i++;
			if (depth === 0) break;
			continue;
		}
		if (ch === "(") {
			parenDepth++;
			i++;
			continue;
		}
		if (ch === ")" && parenDepth > 0) {
			parenDepth--;
			i++;
			continue;
		}
		if (ch === "[") {
			bracketDepth++;
			i++;
			continue;
		}
		if (ch === "]" && bracketDepth > 0) {
			bracketDepth--;
			i++;
			continue;
		}
		if (depth === 1 && parenDepth === 0 && bracketDepth === 0) {
			if (ch === ",") {
				expectKey = true;
				i++;
				continue;
			}
			if (expectKey && /[A-Za-z_$]/.test(ch)) {
				const start = i++;
				while (i < len && /[\w$]/.test(source[i])) i++;
				let j = i;
				while (j < len && /\s/.test(source[j])) j++;
				if (source[j] === ":" || source[j] === "," || source[j] === "}") {
					keys.push(source.slice(start, i));
					expectKey = false;
				}
				continue;
			}
		}
		i++;
	}
	return keys;
};

const isMarkdownAlternate = (attrs) => {
	const rels = (attrs.rel || "").toLowerCase().split(/\s+/).filter(Boolean);
	const mediaType = (attrs.type || "").split(";")[0].trim().toLowerCase();
	return rels.includes("alternate") && mediaType === "text/markdown";
};

const stripQueryAndHash = (ref) => {
	const idx = ref.search(/[?#]/);
	return idx === -1 ? ref : ref.slice(0, idx);
};

export default class Linter {
	static check(file, source, availableLocales = null) {
		if (!file.endsWith(".html")) return [];
		const violations = [];
		const document = Markup.parse(file, source, {
			sourceCodeLocationInfo: true,
		});
		Linter.#checkHtmlRules(document, violations, file, availableLocales);
		return violations;
	}

	static extractMarkdownAlternates(file, source) {
		const document = Markup.parse(file, source, {
			sourceCodeLocationInfo: true,
		});
		const links = [];
		Linter.#traverse(document, (node) => {
			if (node.nodeName !== "link") return;
			const attrs = node.attrs
				? Object.fromEntries(
						node.attrs.map((a) => [a.name.toLowerCase(), a.value]),
					)
				: {};
			if (!isMarkdownAlternate(attrs)) return;
			const href = (attrs.href || "").trim();
			if (!href) return;
			const dynamic = Object.hasOwn(attrs, "data-otm-dynamic");
			const loc = node.sourceCodeLocation?.attrs?.href ||
				node.sourceCodeLocation || { startLine: 1, startCol: 1 };
			links.push({
				file,
				href,
				dynamic,
				line: loc.startLine,
				column: loc.startCol,
			});
		});
		return links;
	}

	static extractLlmsLinks(source) {
		const links = [];
		const lines = source.split(/\r?\n/);
		let inFence = false;
		for (let idx = 0; idx < lines.length; idx++) {
			const line = lines[idx];
			if (/^\s*(?:```|~~~)/.test(line)) {
				inFence = !inFence;
				continue;
			}
			if (inFence) continue;
			// Blank out inline code spans so syntax examples don't trigger link checks.
			const clean = line.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));
			for (const m of clean.matchAll(/(?<!!)\[([^\]]*)\]\(([^)]*)\)/g)) {
				const rawTarget = m[2].trim();
				// Allow optional Markdown link title after whitespace (e.g. README.md "Docs")
				const closeAngle = rawTarget.indexOf(">");
				const target = rawTarget.startsWith("<")
					? closeAngle > 1
						? rawTarget.slice(1, closeAngle).trim()
						: ""
					: rawTarget.split(/\s+/)[0] || "";
				links.push({
					label: m[1].trim(),
					target,
					rawTarget,
					line: idx + 1,
					column: m.index + 1,
				});
			}
		}
		return links;
	}

	static isCheckableLocalTarget(target, { checkRootRelative = false } = {}) {
		if (!target || target.startsWith("#")) return false;
		if (EXTERNAL_URL_RE.test(target)) return false;
		const pathname = stripQueryAndHash(target);
		if (!pathname || TEMPLATE_EXPR_RE.test(pathname)) return false;
		if (pathname.startsWith("/")) return checkRootRelative;
		return true;
	}

	static checkLlmsTxt(file, source) {
		const violations = [];
		const lines = source.split(/\r?\n/);
		const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
		if (
			firstNonEmptyIdx === -1 ||
			!/^#\s+\S/.test(lines[firstNonEmptyIdx].trim())
		) {
			Linter.#addViolation(
				violations,
				file,
				{ line: firstNonEmptyIdx === -1 ? 1 : firstNonEmptyIdx + 1, column: 1 },
				"LLMS-001",
				'llms.txt must begin with an H1 title line ("# Project Name") per the llms.txt specification.',
			);
		}

		for (const link of Linter.extractLlmsLinks(source)) {
			if (!link.label || !link.target) {
				Linter.#addViolation(
					violations,
					file,
					{ line: link.line, column: link.column },
					"LLMS-001",
					"Malformed Markdown link in llms.txt; provide both non-empty link text and a target URL.",
				);
			}
		}

		return violations;
	}

	static #checkHtmlRules(document, violations, file, availableLocales) {
		let hasI18nMeta = false;
		let hasI18nPath = true;
		let manifestMatches = true;
		let isFullDocument = false;
		const documentNavs = [];
		const idElements = new Map();
		const comboboxes = [];

		Linter.#traverse(document, (node, inTemplate) => {
			if (
				(node.nodeName === "html" || node.nodeName === "#documentType") &&
				node.sourceCodeLocation
			) {
				isFullDocument = true;
			}

			const attrs = node.attrs
				? Object.fromEntries(node.attrs.map((a) => [a.name, a.value]))
				: {};
			const lowerAttrs = node.attrs
				? Object.fromEntries(
						node.attrs.map((a) => [a.name.toLowerCase(), a.value]),
					)
				: {};

			if (lowerAttrs.id?.trim() && !idElements.has(lowerAttrs.id.trim())) {
				idElements.set(lowerAttrs.id.trim(), { node, attrs: lowerAttrs });
			}
			if (lowerAttrs.role?.trim().toLowerCase() === "combobox") {
				comboboxes.push({ node, attrs: lowerAttrs });
			}

			if (node.nodeName === "nav" && !inTemplate) {
				documentNavs.push({ node, attrs: lowerAttrs });
			}

			if (
				node.nodeName === "link" &&
				isMarkdownAlternate(lowerAttrs) &&
				!lowerAttrs.href?.trim()
			) {
				const loc = node.sourceCodeLocation || { startLine: 1, startCol: 1 };
				Linter.#addViolation(
					violations,
					file,
					{ line: loc.startLine, column: loc.startCol },
					"HTML-029",
					'<link rel="alternate" type="text/markdown"> requires a non-empty href pointing to the canonical Markdown representation.',
				);
			}
			const localeAttrs =
				node.nodeName === "html"
					? ["lang"]
					: node.nodeName === "meta" && attrs.name === "i18n"
						? ["data-available", "data-fallback"]
						: [];
			for (const attr of localeAttrs) {
				const values =
					attr === "data-available"
						? (attrs[attr] || "").split(",")
						: [attrs[attr] || ""];
				for (const tag of values.map((s) => s.trim()).filter(Boolean)) {
					try {
						new Intl.Locale(tag);
					} catch (cause) {
						const loc = node.sourceCodeLocation?.attrs?.[attr] || {
							startLine: 1,
							startCol: 1,
						};
						Linter.#addViolation(
							violations,
							file,
							{ line: loc.startLine, column: loc.startCol },
							"HTML-026",
							`Invalid locale ${JSON.stringify(tag)} in ${attr}: ${cause.message}. Use Unicode locale tags such as fr-CA or sr-Latn.`,
						);
					}
				}
			}

			if (node.nodeName === "meta" && attrs.name === "i18n") {
				hasI18nMeta = true;
				hasI18nPath = Boolean(attrs.content?.trim());
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

			if (
				attrs["data-i18n-type"] === "currency" &&
				!attrs["data-i18n-currency"]
			) {
				const loc = node.sourceCodeLocation?.attrs?.["data-i18n-type"] ||
					node.sourceCodeLocation || { startLine: 1, startCol: 1 };
				Linter.#addViolation(
					violations,
					file,
					{ line: loc.startLine, column: loc.startCol },
					"HTML-025",
					'data-i18n-type="currency" without data-i18n-currency — _t() throws at runtime without an explicit code. Add data-i18n-currency (ISO 4217, e.g. "EUR").',
				);
			}

			if (
				attrs["data-i18n-type"] === "date" &&
				(!attrs["data-i18n-val"]?.trim() ||
					Number.isNaN(Date.parse(attrs["data-i18n-val"])))
			) {
				const loc = node.sourceCodeLocation?.attrs?.["data-i18n-type"] || {
					startLine: 1,
					startCol: 1,
				};
				Linter.#addViolation(
					violations,
					file,
					{ line: loc.startLine, column: loc.startCol },
					"HTML-027",
					'Date formatting requires a valid data-i18n-val. Use ISO date text and set data-i18n-type="date" only after its value is available.',
				);
			}
		});

		if (documentNavs.length > 1) {
			const seenLabels = new Set();
			for (const { node, attrs } of documentNavs) {
				const label = (attrs["aria-label"] || "").trim();
				const labelledBy = (attrs["aria-labelledby"] || "").trim();
				const loc = node.sourceCodeLocation || { startLine: 1, startCol: 1 };
				if (!label && !labelledBy) {
					Linter.#addViolation(
						violations,
						file,
						{ line: loc.startLine, column: loc.startCol },
						"HTML-028",
						"Multiple <nav> landmarks in one document require distinguishing aria-label or aria-labelledby attributes.",
					);
				} else if (label) {
					const normalized = label.toLowerCase();
					if (seenLabels.has(normalized)) {
						Linter.#addViolation(
							violations,
							file,
							{ line: loc.startLine, column: loc.startCol },
							"HTML-028",
							`Duplicate <nav aria-label="${label}"> landmark; use unique labels to distinguish sibling navigations.`,
						);
					}
					seenLabels.add(normalized);
				}
			}
		}

		// HTML-030: WAI-ARIA APG Combobox markup wiring contract.
		for (const { node, attrs } of comboboxes) {
			if (Object.hasOwn(attrs, "data-otm-dynamic")) continue;
			const loc = node.sourceCodeLocation || { startLine: 1, startCol: 1 };
			const expanded = attrs["aria-expanded"]?.trim().toLowerCase();
			if (expanded !== "true" && expanded !== "false") {
				Linter.#addViolation(
					violations,
					file,
					{ line: loc.startLine, column: loc.startCol },
					"HTML-030",
					'role="combobox" requires an explicit aria-expanded="false" (or "true") attribute per WAI-ARIA APG.',
				);
			}
			if (Object.hasOwn(attrs, "aria-autocomplete")) {
				const ac = attrs["aria-autocomplete"].trim().toLowerCase();
				if (!["none", "inline", "list", "both"].includes(ac)) {
					Linter.#addViolation(
						violations,
						file,
						{ line: loc.startLine, column: loc.startCol },
						"HTML-030",
						`Invalid aria-autocomplete="${attrs["aria-autocomplete"]}" on role="combobox"; expected "none", "inline", "list", or "both".`,
					);
				}
			}
			const controls = (attrs["aria-controls"] || "").trim();
			if (!controls) {
				Linter.#addViolation(
					violations,
					file,
					{ line: loc.startLine, column: loc.startCol },
					"HTML-030",
					'role="combobox" requires aria-controls referencing the controlled [role="listbox"] element id.',
				);
				continue;
			}
			if (TEMPLATE_EXPR_RE.test(controls)) continue;
			const target = idElements.get(controls);
			if (!target) {
				Linter.#addViolation(
					violations,
					file,
					{ line: loc.startLine, column: loc.startCol },
					"HTML-030",
					`role="combobox" references aria-controls="${controls}", but no element with id="${controls}" exists in this document. Add the [role="listbox"] or mark the combobox data-otm-dynamic.`,
				);
				continue;
			}
			const targetLoc = target.node.sourceCodeLocation || {
				startLine: 1,
				startCol: 1,
			};
			if (target.attrs.role?.trim().toLowerCase() !== "listbox") {
				Linter.#addViolation(
					violations,
					file,
					{ line: targetLoc.startLine, column: targetLoc.startCol },
					"HTML-030",
					`role="combobox" aria-controls="${controls}" must reference an element with role="listbox".`,
				);
				continue;
			}
			if (
				!target.attrs["aria-label"]?.trim() &&
				!target.attrs["aria-labelledby"]?.trim()
			) {
				Linter.#addViolation(
					violations,
					file,
					{ line: targetLoc.startLine, column: targetLoc.startCol },
					"HTML-030",
					`Combobox listbox #${controls} requires an accessible name (aria-label or aria-labelledby) per WAI-ARIA APG.`,
				);
			}
			if (Object.hasOwn(target.attrs, "popover")) {
				const mode = target.attrs.popover.trim().toLowerCase();
				if (mode !== "manual") {
					Linter.#addViolation(
						violations,
						file,
						{ line: targetLoc.startLine, column: targetLoc.startCol },
						"HTML-030",
						`Combobox listbox #${controls} uses popover="${target.attrs.popover || "auto"}"; use popover="manual" so native light-dismiss does not conflict with combobox focus and Escape handling.`,
					);
				}
			}
		}

		if (isFullDocument && hasI18nMeta) {
			if (!hasI18nPath) {
				Linter.#addViolation(
					violations,
					file,
					{ line: 1, column: 1 },
					"HTML-023",
					'A declared <meta name="i18n"> requires a dictionary path in content. Omit the meta for a source-language-only document.',
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
		const cleanJsSources = jsSources.map(({ file, source }) => ({
			file,
			source: stripJsComments(source),
		}));
		const cleanCssSources = cssSources.map(({ file, source }) => ({
			file,
			source: stripCssComments(source),
		}));

		// HTML-101: orphan templates — <template id="X"> never referenced by $.clone(_, "#X")
		const templates = new Map();
		for (const { file, source } of htmlSources) {
			const document = Markup.parse(file, source, {
				sourceCodeLocationInfo: true,
			});
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
		for (const { source } of cleanJsSources) {
			const matches = source.matchAll(
				/\$\.(?:clone(?:Each)?|reconcile)\s*\([^,)]+,\s*['"]#([^'"]+)['"]/g,
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

			const document = Markup.parse(file, source, {
				sourceCodeLocationInfo: true,
			});
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
						attr.name !== "data-i18n-type" &&
						attr.name !== "data-i18n-currency"
					) {
						params.push(attr.name.replace("data-i18n-", ""));
					}
				}
				const loc = node.sourceCodeLocation?.attrs?.["data-i18n"] ||
					node.sourceCodeLocation || { startLine: 1, startCol: 1 };
				const where = { line: loc.startLine, column: loc.startCol };

				const foundIn = dicts.filter((d) => key in d.dict);
				if (foundIn.length === 0) {
					// The rendered source text is a valid final fallback, not a missing dictionary.
					const text = (node) =>
						node.nodeName === "#text"
							? node.value
							: (node.childNodes || []).map(text).join("");
					if (text(node).trim()) return;
					Linter.#addViolation(
						violations,
						file,
						where,
						"HTML-102",
						`i18n key "${key}" has no source text and is not declared in any locale dictionary (${dicts.map((d) => d.locale).join(", ")}).`,
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
		// or data-bind slots inside <template> or [data-otm-scope] subtrees —
		// global writes walk the whole document and clobber every scoped slot.
		const globalWriteKeys = Linter.#globalWriteKeys(cleanJsSources);

		for (const { file, source } of htmlSources) {
			const document = Markup.parse(file, source, {
				sourceCodeLocationInfo: true,
			});
			Linter.#traverse(document, (inner, inTemplate, inScope) => {
				if (!inTemplate && !inScope) return;
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
					const context = inTemplate
						? "a <template>"
						: "a [data-otm-scope] subtree";
					Linter.#addViolation(
						violations,
						file,
						{ line: loc.startLine, column: loc.startCol },
						"HTML-104",
						`Scoped slot ${attr} key "${key}" inside ${context} collides with the global the("${key}", ...) write in ${writer.file}:${writer.line} — the global write walks the whole document and will clobber it. Rename the scoped slot key or the global key.`,
					);
				}
			});
		}

		// HTML-105: data-action values in HTML ↔ [data-action="..."] selector
		// literals in JS, both directions. A generic [data-action] selector in
		// JS (action-dispatch pattern) waives the dead-control direction.
		const actionRefs = new Map();
		let wildcardDispatch = false;
		for (const { file, source } of cleanJsSources) {
			if (/\[data-action\]/.test(source)) wildcardDispatch = true;
			for (const m of source.matchAll(/\[data-action=["']?([\w-]+)["']?\]/g)) {
				if (!actionRefs.has(m[1]))
					actionRefs.set(m[1], { file, line: Linter.#lineOf(source, m.index) });
			}
		}

		const actionValues = new Set();
		for (const { file, source } of htmlSources) {
			const document = Markup.parse(file, source, {
				sourceCodeLocationInfo: true,
			});
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
		for (const { source } of cleanCssSources) {
			for (const m of source.matchAll(/\[data-([a-z0-9-]+)/g))
				consumed.add(m[1]);
		}
		for (const { file, source } of htmlSources) {
			const markup = stripCssComments(Markup.source(file, source));
			// Inline <style> blocks ride along in the raw HTML source.
			for (const m of markup.matchAll(/\[data-([a-z0-9-]+)/g))
				consumed.add(m[1]);
			for (const m of markup.matchAll(/data-text=["']([\w-]+)["']/g))
				consumed.add(m[1]);
			for (const m of markup.matchAll(/data-bind=["']([^"']+)["']/g)) {
				for (const pair of m[1].split(/\s+/)) {
					const i = pair.indexOf(":");
					if (i >= 1) consumed.add(pair.slice(i + 1));
				}
			}
		}
		for (const { source } of cleanJsSources) {
			for (const m of source.matchAll(/["']data-([a-z0-9-]+)["']/g))
				consumed.add(m[1]);
			for (const m of source.matchAll(/\bthe\s*\(\s*["']([^"']+)["']\s*\)/g))
				consumed.add(m[1]);
		}

		for (const [key, writer] of globalWriteKeys) {
			if (consumed.has(key)) continue;
			Linter.#addViolation(
				violations,
				writer.file,
				{ line: writer.line, column: 1 },
				"HTML-106",
				`State key "${key}" is written via the() but never consumed by a CSS attribute selector, a [data-text] slot, or a JS data-attribute reference — dead state or a missing CSS rule (the deletion test).`,
			);
		}

		// HTML-107: reveal-key parity. A span carrying data-K-key="V" shows
		// only under a state-CSS rule matching [data-K="V"]; a rule
		// referencing [data-K-key="V"] needs a span carrying it. Either half
		// missing = the message silently never shows (the twice-hand-fixed
		// bug class this rule automates).
		const revealSpans = [];
		const spanPairs = new Set(); // includes data-otm-dynamic spans — they
		// still satisfy the css→span direction; only the span→css check is waived
		for (const { file, source } of htmlSources) {
			const document = Markup.parse(file, source, {
				sourceCodeLocationInfo: true,
			});
			Linter.#traverse(document, (node) => {
				for (const attr of node.attrs ?? []) {
					const m = attr.name.match(/^data-([a-z0-9-]+)-key$/);
					if (!m || m[1] === "i18n" || !attr.value) continue;
					spanPairs.add(`${m[1]} ${attr.value}`);
					if (node.attrs.some((a) => a.name === "data-otm-dynamic")) continue;
					const loc = node.sourceCodeLocation?.attrs?.[attr.name] ||
						node.sourceCodeLocation || { startLine: 1, startCol: 1 };
					revealSpans.push({
						group: m[1],
						value: attr.value,
						file,
						line: loc.startLine,
						column: loc.startCol,
					});
				}
			});
		}

		// Inline <style> blocks ride along in the raw HTML sources.
		// Pairing is by CSS *reference*, never by name coupling: the state key
		// that reveals a span may be named anything (body[data-form-error="V"]
		// revealing [data-error-key="V"] is fully functional) — a reveal rule
		// necessarily references the span it reveals, so the ref IS the proof.
		const styleTexts = [...cleanCssSources, ...htmlSources];
		const spanRefs = [];
		const refPairs = new Set();
		for (const { file, source } of styleTexts) {
			const styleSource = stripCssComments(Markup.source(file, source));
			for (const m of styleSource.matchAll(
				/\[data-([a-z0-9-]+?)-key=["']?([\w-]+)["']?\]/g,
			)) {
				refPairs.add(`${m[1]} ${m[2]}`);
				spanRefs.push({
					group: m[1],
					value: m[2],
					file,
					line: Linter.#lineOf(styleSource, m.index),
				});
			}
		}

		for (const span of revealSpans) {
			if (refPairs.has(`${span.group} ${span.value}`)) continue;
			Linter.#addViolation(
				violations,
				span.file,
				{ line: span.line, column: span.column },
				"HTML-107",
				`Reveal span data-${span.group}-key="${span.value}" is referenced by no state-CSS rule — the message can never show. Add a reveal rule selecting [data-${span.group}-key="${span.value}"], or delete the span, or mark it data-otm-dynamic.`,
			);
		}

		// An empty span universe is evidence of blindness (markup living in
		// templates the scan can't see), not of dead wiring — the css→span
		// direction only fires when at least one reveal span was found.
		for (const ref of spanPairs.size > 0 ? spanRefs : []) {
			if (spanPairs.has(`${ref.group} ${ref.value}`)) continue;
			Linter.#addViolation(
				violations,
				ref.file,
				{ line: ref.line, column: 1 },
				"HTML-107",
				`State-CSS references [data-${ref.group}-key="${ref.value}"] but no element carries it — dead wiring. Add the span or delete the rule.`,
			);
		}

		return violations;
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
				const k = m[1];
				if (!keys.has(k))
					keys.set(k, { file, line: Linter.#lineOf(source, m.index) });
			}
			for (const m of source.matchAll(/\bthe\s*\(\s*\{/g)) {
				const openBrace = m.index + m[0].length - 1;
				for (const k of extractTopLevelObjectKeys(source, openBrace)) {
					if (!keys.has(k))
						keys.set(k, { file, line: Linter.#lineOf(source, m.index) });
				}
			}
		}
		return keys;
	}

	static #traverse(node, visitor, inTemplate = false, inScope = false) {
		const hasScope = Boolean(
			node.attrs?.some((a) => a.name.toLowerCase() === "data-otm-scope"),
		);
		const nodeInScope = inScope || hasScope;
		visitor(node, inTemplate, nodeInScope);
		const childInTemplate = inTemplate || node.nodeName === "template";
		// parse5 templates keep children under content.childNodes while
		// childNodes stays a truthy empty array — walk both.
		for (const child of node.childNodes || [])
			Linter.#traverse(child, visitor, childInTemplate, nodeInScope);
		for (const child of node.content?.childNodes || [])
			Linter.#traverse(child, visitor, true, nodeInScope);
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
