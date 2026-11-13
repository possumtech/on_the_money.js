import pkg from "../../package.json" with { type: "json" };

const meta = {
	name: "eslint-plugin-otm",
	version: pkg.version,
};

const preferOn = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow direct addEventListener; use on() from on_the_money for event delegation.",
		},
		messages: {
			onSignature:
				"on() requires four arguments: parent, event, selector, handler. For a form's own submit event, use on(form, 'submit', 'form', handler).",
			onTargetSignature:
				"on.target() requires three or four arguments: target, event, handler[, options]. For DOM elements, use delegated on(parent, event, selector, handler).",
			onTargetDom:
				"DOM elements use delegated on(parent, event, selector, handler), not on.target().",
			useOn:
				"Direct addEventListener is forbidden — use on(parent, event, selector, handler) for DOM delegation, on.target(target, event, handler, { signal }) for shared non-Element EventTargets (window, document, visualViewport, AbortSignal, MediaQueryList), or handler properties (worker.onmessage = fn) for privately owned 1:1 targets; sockets get live() from on_the_money/live. Common LLM mistake: copying raw addEventListener patterns instead of OTM's event helpers. See README §The Discipline.",
		},
		schema: [],
	},
	create(context) {
		const resolvesToOn = (node, identifier) => {
			if (identifier?.type !== "Identifier") return { match: false };
			const reference = context.sourceCode
				.getScope(node)
				.references.find((ref) => ref.identifier === identifier);
			if (!reference?.resolved)
				return { match: identifier.name === "on", namespace: false };
			const definition = reference.resolved.defs[0];
			const source = definition?.parent?.source?.value;
			if (
				definition?.type !== "ImportBinding" ||
				!(source === "on_the_money" || source?.endsWith("/src/core/index.js"))
			)
				return { match: false };
			if (
				["ImportNamespaceSpecifier", "ImportDefaultSpecifier"].includes(
					definition.node.type,
				)
			) {
				return { match: true, namespace: true };
			}
			return {
				match: definition.node.imported?.name === "on",
				namespace: false,
			};
		};
		const isOn = (node) => {
			const callee = node.callee;
			if (callee.type === "Identifier") {
				const res = resolvesToOn(node, callee);
				return res.match && !res.namespace;
			}
			if (
				callee.type === "MemberExpression" &&
				!callee.computed &&
				callee.property.name === "on"
			) {
				const res = resolvesToOn(node, callee.object);
				return res.match && res.namespace;
			}
			return false;
		};
		const isOnTarget = (node) => {
			const callee = node.callee;
			if (
				callee.type !== "MemberExpression" ||
				callee.computed ||
				callee.property.name !== "target"
			)
				return false;
			if (callee.object.type === "Identifier") {
				const res = resolvesToOn(node, callee.object);
				return res.match && !res.namespace;
			}
			if (
				callee.object.type === "MemberExpression" &&
				!callee.object.computed &&
				callee.object.property.name === "on"
			) {
				const res = resolvesToOn(node, callee.object.object);
				return res.match && res.namespace;
			}
			return false;
		};
		return {
			CallExpression(node) {
				if (
					isOn(node) &&
					node.arguments.length !== 4 &&
					!node.arguments.some((arg) => arg.type === "SpreadElement")
				) {
					context.report({ node, messageId: "onSignature" });
				}
				if (isOnTarget(node)) {
					if (
						(node.arguments.length < 3 || node.arguments.length > 4) &&
						!node.arguments.some((arg) => arg.type === "SpreadElement")
					) {
						context.report({ node, messageId: "onTargetSignature" });
						return;
					}
					const first = node.arguments[0];
					if (
						first?.type === "MemberExpression" &&
						!first.computed &&
						first.object?.type === "Identifier" &&
						first.object.name === "document" &&
						(first.property?.name === "body" ||
							first.property?.name === "documentElement")
					) {
						context.report({ node, messageId: "onTargetDom" });
					}
				}
				if (node.callee?.property?.name === "addEventListener") {
					context.report({ node, messageId: "useOn" });
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
				"Browser-DOM emulation library '{{name}}' is forbidden in application code. Common LLM mistake: importing a server-side DOM shim to run OTM outside the browser. Render real HTML documents on the server and enhance them in the browser, or use 'on_the_money/test' in '*.test.*' files. See README §The Discipline.",
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

const noRawWebsocket = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow raw WebSocket construction; use live() from on_the_money/live.",
		},
		messages: {
			useLive:
				"Raw WebSocket construction is forbidden. Use live() from on_the_money/live — it owns reconnection, jittered backoff, JSON dispatch, and req_id correlation. Common LLM mistake: hand-rolling the socket lifecycle per consumer. See README §on_the_money/live.",
		},
		schema: [],
	},
	create(context) {
		return {
			NewExpression(node) {
				if (node.callee?.name !== "WebSocket") return;
				// Only the browser GLOBAL is banned. An imported or locally
				// declared WebSocket (a Node ws-package client) resolves to a
				// definition and is outside live()'s reach — let it pass.
				const scope = context.sourceCode.getScope(node);
				const ref = scope.references.find((r) => r.identifier === node.callee);
				if (ref?.resolved?.defs.length) return;
				context.report({ node, messageId: "useLive" });
			},
		};
	},
};

const rules = {
	"prefer-on": preferOn,
	"flat-state": flatState,
	"prefer-submit": preferSubmit,
	"no-style-mutation": noStyleMutation,
	"no-server-dom": noServerDom,
	"no-document-query": noDocumentQuery,
	"no-raw-websocket": noRawWebsocket,
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
			"otm/flat-state": "error",
			"otm/prefer-submit": "warn",
			"otm/no-style-mutation": "error",
			"otm/no-server-dom": "error",
			"otm/no-document-query": "error",
			"otm/no-raw-websocket": "error",
		},
	},
};

export default plugin;
