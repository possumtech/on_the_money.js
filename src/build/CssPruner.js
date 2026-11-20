import selectorParser from "postcss-selector-parser";
import Markup from "../linter/Markup.js";

const ALWAYS_KEEP_TAGS = new Set([
	"html",
	"body",
	"head",
	"title",
	"meta",
	"link",
	"script",
	"style",
]);

const CONTAINER_AT_RULES = new Set([
	"layer",
	"media",
	"supports",
	"container",
	"starting-style",
	"scope",
]);

export default class CssPruner {
	// Pure parse5 walk across HTML documents and their <template> contents.
	// Sound because OTM forbids JS-driven HTML injection (otm/no-innerhtml,
	// otm/no-dom-building) — all dynamic markup lives statically in <template>.
	static collectUsedTags(htmlSources = []) {
		const tags = new Set(ALWAYS_KEEP_TAGS);

		const walk = (node) => {
			if (!node) return;
			if (node.tagName) tags.add(node.tagName.toLowerCase());
			if (node.content) walk(node.content);
			for (const child of node.childNodes || []) walk(child);
		};

		for (const { file, source } of htmlSources) {
			const doc = Markup.parse(file || "index.html", source);
			walk(doc);
		}

		return tags;
	}

	static selectorIsUsed(selectorNode, usedTags) {
		let used = true;
		selectorNode.walkTags((tagNode) => {
			if (!used) return;
			// Ignore tags inside :not(...) — negations don't require the negated tag to exist.
			let cur = tagNode.parent;
			while (cur && cur !== selectorNode) {
				if (
					cur.type === "pseudo" &&
					(cur.value === ":not" || cur.value === ":has")
				) {
					return;
				}
				cur = cur.parent;
			}
			const name = tagNode.value.toLowerCase();
			if (name !== "*" && !usedTags.has(name)) {
				used = false;
			}
		});
		return used;
	}

	static filterSelectorList(selectorText, usedTags) {
		const kept = [];
		try {
			selectorParser((selectors) => {
				for (const sel of selectors.nodes) {
					if (CssPruner.selectorIsUsed(sel, usedTags)) {
						kept.push(sel.toString().trim());
					}
				}
			}).processSync(selectorText);
		} catch {
			return selectorText;
		}
		return kept.join(", ");
	}

	static prune(css, usedTags) {
		return CssPruner.#pruneBlock(css, usedTags, false);
	}

	static #pruneBlock(css, usedTags, insideStyleRule) {
		const out = [];
		let i = 0;
		const len = css.length;

		while (i < len) {
			// Skip whitespace
			const wsStart = i;
			while (i < len && /\s/.test(css[i])) i++;
			if (i > wsStart) out.push(css.slice(wsStart, i));
			if (i >= len) break;

			// Preserve comments
			if (css[i] === "/" && css[i + 1] === "*") {
				const end = css.indexOf("*/", i + 2);
				const close = end === -1 ? len : end + 2;
				out.push(css.slice(i, close));
				i = close;
				continue;
			}

			// Read prelude up to `;` or `{` (respecting strings, comments, parens)
			const start = i;
			let parenDepth = 0;
			let delim = "";
			while (i < len) {
				const ch = css[i];
				if (ch === '"' || ch === "'") {
					i = CssPruner.#skipString(css, i);
					continue;
				}
				if (ch === "/" && css[i + 1] === "*") {
					const end = css.indexOf("*/", i + 2);
					i = end === -1 ? len : end + 2;
					continue;
				}
				if (ch === "(") parenDepth++;
				else if (ch === ")" && parenDepth > 0) parenDepth--;
				else if (parenDepth === 0 && (ch === ";" || ch === "{")) {
					delim = ch;
					break;
				}
				i++;
			}

			const prelude = css.slice(start, i);
			if (delim === ";") {
				out.push(`${prelude};`);
				i++;
				continue;
			}
			if (delim !== "{") {
				out.push(prelude);
				break;
			}

			// Extract balanced `{ ... }` body
			const bodyStart = i + 1;
			const bodyEnd = CssPruner.#findBlockEnd(css, i);
			const body = css.slice(bodyStart, bodyEnd);
			i = bodyEnd + 1;

			const trimmed = prelude.trim();
			if (trimmed.startsWith("@")) {
				const atMatch = trimmed.match(/^@([a-zA-Z-]+)/);
				const atName = atMatch ? atMatch[1].toLowerCase() : "";
				if (CONTAINER_AT_RULES.has(atName)) {
					const prunedBody = CssPruner.#pruneBlock(
						body,
						usedTags,
						insideStyleRule,
					);
					if (prunedBody.trim().length > 0) {
						out.push(`${prelude}{${prunedBody}}`);
					}
				} else {
					// @keyframes, @font-face, @property, etc. — always keep intact
					out.push(`${prelude}{${body}}`);
				}
				continue;
			}

			// Nested rules inside an already-kept parent style rule are preserved as-is
			// (nesting `&` selectors inherit parent context).
			if (insideStyleRule) {
				out.push(`${prelude}{${body}}`);
				continue;
			}

			const filtered = CssPruner.filterSelectorList(trimmed, usedTags);
			if (filtered.length > 0) {
				out.push(`${filtered} {${body}}`);
			}
		}

		return out.join("");
	}

	static #skipString(css, start) {
		const quote = css[start];
		let i = start + 1;
		while (i < css.length) {
			if (css[i] === "\\") {
				i += 2;
				continue;
			}
			if (css[i] === quote) return i + 1;
			i++;
		}
		return css.length;
	}

	static #findBlockEnd(css, openBrace) {
		let depth = 0;
		let i = openBrace;
		while (i < css.length) {
			const ch = css[i];
			if (ch === '"' || ch === "'") {
				i = CssPruner.#skipString(css, i);
				continue;
			}
			if (ch === "/" && css[i + 1] === "*") {
				const end = css.indexOf("*/", i + 2);
				i = end === -1 ? css.length : end + 2;
				continue;
			}
			if (ch === "{") depth++;
			else if (ch === "}") {
				depth--;
				if (depth === 0) return i;
			}
			i++;
		}
		return css.length;
	}
}
