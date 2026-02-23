import * as csstree from "css-tree";
import * as espree from "espree";
import * as parse5 from "parse5";

export default class Linter {
	static check(file, source) {
		const ext = file.split(".").pop();
		const violations = [];

		if (ext === "js") {
			const ast = espree.parse(source, {
				ecmaVersion: "latest",
				sourceType: "module",
				loc: true,
			});
			Linter.#checkJsRules(ast, violations, file);
		} else if (ext === "html") {
			const document = parse5.parse(source, { sourceCodeLocationInfo: true });
			Linter.#checkHtmlRules(document, violations, file);
		} else if (ext === "css") {
			const ast = csstree.parse(source, { positions: true });
			Linter.#checkCssRules(ast, violations, file);
		}

		return violations;
	}

	static #checkJsRules(ast, violations, file) {
		Linter.#traverseJs(ast, (node) => {
			// JS-001: No innerHTML
			if (
				node.type === "AssignmentExpression" &&
				node.left?.property?.name === "innerHTML"
			) {
				Linter.#addViolation(
					violations,
					file,
					node.loc.start,
					"JS-001",
					"Assignment to innerHTML is strictly forbidden.",
				);
			}

			// JS-003: No direct style manipulation
			if (Linter.#isStyle(node)) {
				Linter.#addViolation(
					violations,
					file,
					node.loc.start,
					"JS-003",
					"Direct style manipulation is forbidden. Use the() and CSS instead.",
				);
			}

			// JS-009: No addEventListener
			if (
				node.type === "CallExpression" &&
				node.callee?.property?.name === "addEventListener"
			) {
				Linter.#addViolation(
					violations,
					file,
					node.loc.start,
					"JS-009",
					"Direct addEventListener is forbidden. Use on() for event delegation.",
				);
			}

			// JS-011: No dynamic attribute names
			if (
				node.type === "CallExpression" &&
				node.callee?.property?.name === "setAttribute" &&
				node.arguments?.[0]?.type !== "Literal"
			) {
				Linter.#addViolation(
					violations,
					file,
					node.loc.start,
					"JS-011",
					"Dynamic attribute names are forbidden. Use static strings only.",
				);
			}

			// JS-015: No direct text manipulation
			if (
				node.type === "AssignmentExpression" &&
				["textContent", "innerText", "nodeValue"].includes(
					node.left?.property?.name,
				)
			) {
				Linter.#addViolation(
					violations,
					file,
					node.loc.start,
					"JS-015",
					"Direct text manipulation is forbidden. Use the() or the._t() instead.",
				);
			}

			// JS-016: Flat state only (No nested objects in the())
			if (node.type === "CallExpression") {
				const name = node.callee?.name || node.callee?.property?.name;
				if (name === "the") {
					Linter.#checkFlatState(node, violations, file);
				}
			}

			// JS-019: Prefer Form Submit
			if (
				node.type === "CallExpression" &&
				(node.callee?.name === "on" || node.callee?.property?.name === "on") &&
				node.arguments?.[1]?.value === "click" &&
				(node.arguments?.[2]?.value === "button" ||
					node.arguments?.[2]?.value?.includes("button"))
			) {
				Linter.#addViolation(
					violations,
					file,
					node.loc.start,
					"JS-019",
					"Prefer using <form> submit events over direct button click listeners for data gathering.",
				);
			}
		});
	}

	static #checkFlatState(node, violations, file) {
		const args = node.arguments;
		if (args.length === 2) {
			if (args[0].type === "Literal") {
				Linter.#checkPrimitive(args[1], violations, file);
			} else if (args[1].type === "ObjectExpression") {
				args[1].properties.forEach((prop) => {
					Linter.#checkPrimitive(prop.value, violations, file);
				});
			}
		} else if (args.length === 3) {
			Linter.#checkPrimitive(args[2], violations, file);
		}
	}

	static #checkPrimitive(node, violations, file) {
		if (!node) return;
		if (node.type === "ObjectExpression" || node.type === "ArrayExpression") {
			Linter.#addViolation(
				violations,
				file,
				node.loc.start,
				"JS-016",
				"State must be flat. Nested objects or arrays are forbidden in the().",
			);
		}
	}

	static #checkHtmlRules(document, violations, file) {
		Linter.#traverseHtml(document, (node) => {
			const attrs = node.attrs
				? Object.fromEntries(node.attrs.map((a) => [a.name, a.value]))
				: {};

			// HTML-017: Interactive Identity
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
				const hasA11y = attrs["role"] && attrs["tabindex"] !== undefined;

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

			// HTML-018: The Label Law
			const inputTags = ["input", "select", "textarea"];
			if (inputTags.includes(node.nodeName) && attrs["type"] !== "hidden") {
				const hasAriaLabel = attrs["aria-label"] || attrs["aria-labelledby"];
				if (!hasAriaLabel) {
					const loc = node.sourceCodeLocation || { startLine: 1, startCol: 1 };
					Linter.#addViolation(
						violations,
						file,
						{ line: loc.startLine, column: loc.startCol },
						"HTML-018",
						"Form inputs must have a label or aria-label.",
					);
				}
			}

			if (node.attrs) {
				node.attrs.forEach((attr) => {
					if (attr.name.startsWith("on")) {
						const loc =
							node.sourceCodeLocation?.attrs?.[attr.name] ||
							node.sourceCodeLocation;
						Linter.#addViolation(
							violations,
							file,
							loc.startLine
								? { line: loc.startLine, column: loc.startCol }
								: { line: 1, column: 1 },
							"HTML-014",
							`Inline handler '${attr.name}' is forbidden.`,
						);
					}
				});
			}

			if (node.nodeName === "#text") {
				const parentName = node.parentNode?.nodeName;
				if (
					parentName !== "script" &&
					parentName !== "style" &&
					node.value.trim() !== ""
				) {
					const loc = node.sourceCodeLocation || { startLine: 1, startCol: 1 };
					Linter.#addViolation(
						violations,
						file,
						{ line: loc.startLine, column: loc.startCol },
						"HTML-004",
						"Naked strings in HTML are forbidden. Use data-i18n.",
					);
				}
			}
		});
	}

	static #checkCssRules(ast, violations, file) {
		csstree.walk(ast, (node) => {
			if (node.type === "Declaration" && node.important) {
				Linter.#addViolation(
					violations,
					file,
					{ line: node.loc.start.line, column: node.loc.start.column },
					"CSS-006",
					"!important is forbidden.",
				);
			}
			if (node.type === "ClassSelector") {
				Linter.#addViolation(
					violations,
					file,
					{ line: node.loc.start.line, column: node.loc.start.column },
					"CSS-012",
					`Class selector '.${node.name}' is forbidden.`,
				);
			}
		});
	}

	static #isStyle(node) {
		const isAssign =
			node.type === "AssignmentExpression" &&
			node.left?.object?.property?.name === "style";
		const isDelete =
			node.type === "UnaryExpression" &&
			node.operator === "delete" &&
			node.argument?.object?.property?.name === "style";
		return isAssign || isDelete;
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

	static #traverseJs(node, callback) {
		if (!node || typeof node !== "object") return;
		callback(node);
		for (const key of Object.keys(node)) {
			const val = node[key];
			if (val && typeof val === "object") {
				if (Array.isArray(val)) {
					val.forEach((item) => {
						Linter.#traverseJs(item, callback);
					});
				} else {
					Linter.#traverseJs(val, callback);
				}
			}
		}
	}

	static #traverseHtml(node, callback) {
		if (!node) return;
		callback(node);
		if (node.childNodes) {
			node.childNodes.forEach((child) => {
				Linter.#traverseHtml(child, callback);
			});
		}
	}
}
