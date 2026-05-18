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
				const hasI18n = parent?.attrs?.some((a) => a.name === "data-i18n");
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
					!hasI18n
				) {
					const loc = node.sourceCodeLocation || { startLine: 1, startCol: 1 };
					Linter.#addViolation(
						violations,
						file,
						{ line: loc.startLine, column: loc.startCol },
						"HTML-004",
						"Naked strings in HTML are forbidden. Use data-i18n or wrap in a semantic tag.",
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
					"Localization detected, but missing <meta name='i18n' ...>.",
				);
			} else if (!manifestMatches) {
				Linter.#addViolation(
					violations,
					file,
					{ line: 1, column: 1 },
					"HTML-024",
					"The data-available attribute on <meta name='i18n'> does not match the locales folder.",
				);
			}
		}
	}

	static #traverse(node, visitor) {
		visitor(node);
		const children = node.childNodes || node.content?.childNodes;
		if (children) {
			for (const child of children) Linter.#traverse(child, visitor);
		}
	}

	static #addViolation(violations, file, loc, ruleId, message) {
		violations.push({
			file,
			ruleId,
			line: loc.line || loc.startLine,
			column: loc.column || loc.startCol,
			message,
		});
	}
}
