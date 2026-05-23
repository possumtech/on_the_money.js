const meta = {
	name: "eslint-plugin-otm",
	version: "0.3.4",
};

const preferOn = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow direct addEventListener; use on() from on_the_money for event delegation.",
		},
		messages: {
			useOn:
				"Direct addEventListener is forbidden. Use on() for event delegation. Common LLM mistake: copying jQuery / React tutorial patterns — on() is the single delegated-listener idiom. See README §The Discipline.",
		},
		schema: [],
	},
	create(context) {
		return {
			CallExpression(node) {
				if (node.callee?.property?.name === "addEventListener") {
					context.report({ node, messageId: "useOn" });
				}
			},
		};
	},
};

const preferTheSet = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow direct assignment to textContent/innerText/nodeValue; use the() instead.",
		},
		messages: {
			useThe:
				"Direct text manipulation is forbidden. Use the() or [data-text] binding instead. Common LLM mistake: doing this server-side via linkedom/jsdom — same fix, emit JSON and let the OTM client render. See README §The Discipline.",
		},
		schema: [],
	},
	create(context) {
		const banned = new Set(["textContent", "innerText", "nodeValue"]);
		return {
			AssignmentExpression(node) {
				if (
					node.left?.type === "MemberExpression" &&
					banned.has(node.left.property?.name)
				) {
					context.report({ node, messageId: "useThe" });
				}
			},
		};
	},
};

const flatState = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow nested objects or arrays passed to the(); state must be flat primitives.",
		},
		messages: {
			notFlat:
				"State must be flat. Nested objects or arrays are forbidden in the(). Common LLM mistake: passing a nested object — use the.flat(obj) to compose first. See README §The Discipline.",
		},
		schema: [],
	},
	create(context) {
		const isObjectOrArray = (n) =>
			n?.type === "ObjectExpression" || n?.type === "ArrayExpression";

		const checkPrimitive = (node) => {
			if (!node) return;
			if (isObjectOrArray(node)) {
				context.report({ node, messageId: "notFlat" });
			}
		};

		return {
			CallExpression(node) {
				const name = node.callee?.name || node.callee?.property?.name;
				if (name !== "the") return;

				const args = node.arguments;
				if (args.length === 1 && args[0].type === "ObjectExpression") {
					for (const prop of args[0].properties) {
						if (prop.type === "Property") checkPrimitive(prop.value);
					}
				} else if (args.length === 2) {
					if (args[0].type === "Literal") {
						checkPrimitive(args[1]);
					} else if (args[1].type === "ObjectExpression") {
						for (const prop of args[1].properties) {
							if (prop.type === "Property") checkPrimitive(prop.value);
						}
					}
				} else if (args.length === 3) {
					checkPrimitive(args[2]);
				}
			},
		};
	},
};

const preferSubmit = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Prefer form submit events over button click listeners for data gathering.",
		},
		messages: {
			useSubmit:
				"Prefer using <form> submit events over direct button click listeners. Common LLM mistake: per-button click handlers — one form submit handler captures every input route.",
		},
		schema: [],
	},
	create(context) {
		const isButtonSelector = (n) =>
			n?.type === "Literal" &&
			typeof n.value === "string" &&
			(n.value === "button" || n.value.includes("button"));

		return {
			CallExpression(node) {
				const isOn =
					node.callee?.name === "on" || node.callee?.property?.name === "on";
				if (!isOn) return;
				const [, evt, sel] = node.arguments;
				if (evt?.value === "click" && isButtonSelector(sel)) {
					context.report({ node, messageId: "useSubmit" });
				}
			},
		};
	},
};

const noStyleMutation = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow direct style mutation; drive transitions from attribute selectors instead.",
		},
		messages: {
			noStyle:
				"Direct style manipulation is forbidden. Use the() with attribute selectors instead. Common LLM mistake: copying React/Vue inline-style patterns — CSS rules keyed off [data-state=...] handle state-driven styling cleanly. See README §The Discipline.",
		},
		schema: [],
	},
	create(context) {
		const isStyleMember = (node) => {
			let current = node;
			while (current?.type === "MemberExpression") {
				if (
					current.object?.type === "MemberExpression" &&
					current.object.property?.name === "style"
				) {
					return true;
				}
				if (current.property?.name === "style") {
					return current === node;
				}
				current = current.object;
			}
			return false;
		};

		return {
			AssignmentExpression(node) {
				if (node.left?.type !== "MemberExpression") return;
				if (
					node.left.object?.type === "MemberExpression" &&
					node.left.object.property?.name === "style"
				) {
					context.report({ node, messageId: "noStyle" });
				}
			},
			CallExpression(node) {
				const callee = node.callee;
				if (callee?.property?.name === "setProperty" && isStyleMember(callee)) {
					context.report({ node, messageId: "noStyle" });
				}
			},
		};
	},
};

const noServerDom = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow imports of server-side DOM libraries.",
		},
		messages: {
			noServerDom:
				"Server-side DOM library '{{name}}' is forbidden. Common LLM mistake: rendering HTML server-side instead of emitting JSON. The OTM client hydrates static templates via $.clone() + the() — keep server output to data. See README §The Discipline.",
		},
		schema: [],
	},
	create(context) {
		const banned = new Set([
			"linkedom",
			"jsdom",
			"cheerio",
			"parse5",
			"htmlparser2",
			"happy-dom",
			"node-html-parser",
			"parse5-htmlparser2-tree-adapter",
			"fast-html-parser",
		]);
		return {
			ImportDeclaration(node) {
				const src = node.source?.value;
				if (typeof src === "string" && banned.has(src)) {
					context.report({
						node,
						messageId: "noServerDom",
						data: { name: src },
					});
				}
			},
		};
	},
};

const noDocumentQuery = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow direct document.* DOM queries; use $/$$/$.clone instead.",
		},
		messages: {
			noDocumentQuery:
				"Direct document.{{method}} is forbidden. Common LLM mistake: querying through document instead of OTM's selectors. Use $(selector) for one, $$(selector) for many, or $.clone(parent, '#tmpl') for templates. See README §The Discipline.",
		},
		schema: [],
	},
	create(context) {
		const banned = new Set([
			"querySelector",
			"querySelectorAll",
			"getElementById",
			"getElementsByClassName",
			"getElementsByTagName",
			"getElementsByName",
			"createElement",
			"createTextNode",
			"createDocumentFragment",
			"write",
			"writeln",
		]);
		return {
			CallExpression(node) {
				const callee = node.callee;
				if (
					callee?.type === "MemberExpression" &&
					callee.object?.type === "Identifier" &&
					callee.object.name === "document" &&
					banned.has(callee.property?.name)
				) {
					context.report({
						node,
						messageId: "noDocumentQuery",
						data: { method: callee.property.name },
					});
				}
			},
		};
	},
};

const rules = {
	"prefer-on": preferOn,
	"prefer-the-set": preferTheSet,
	"flat-state": flatState,
	"prefer-submit": preferSubmit,
	"no-style-mutation": noStyleMutation,
	"no-server-dom": noServerDom,
	"no-document-query": noDocumentQuery,
};

const plugin = {
	meta,
	rules,
};

plugin.configs = {
	recommended: {
		plugins: { otm: plugin },
		rules: {
			"otm/prefer-on": "error",
			"otm/prefer-the-set": "error",
			"otm/flat-state": "error",
			"otm/prefer-submit": "warn",
			"otm/no-style-mutation": "error",
			"otm/no-server-dom": "error",
			"otm/no-document-query": "error",
		},
	},
};

export default plugin;
