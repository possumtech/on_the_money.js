import path from "node:path";
import selectorParser from "postcss-selector-parser";
import stylelint from "stylelint";

const META_URL = "https://github.com/possumtech/on_the_money.js";

const preferAttributeName = "otm/prefer-attribute-selector";

const preferAttributeMessages = stylelint.utils.ruleMessages(
	preferAttributeName,
	{
		rejected: (cls) =>
			`Class selector "${cls}" is forbidden. Use an attribute selector like [data-state="..."] instead.`,
	},
);

const preferAttributeRule = (primary) => {
	return (root, result) => {
		const validOptions = stylelint.utils.validateOptions(
			result,
			preferAttributeName,
			{
				actual: primary,
				possible: [true, false],
			},
		);
		if (!validOptions || !primary) return;

		root.walkRules((rule) => {
			selectorParser((selectors) => {
				selectors.walkClasses((classNode) => {
					stylelint.utils.report({
						message: preferAttributeMessages.rejected(`.${classNode.value}`),
						node: rule,
						result,
						ruleName: preferAttributeName,
					});
				});
			}).processSync(rule.selector);
		});
	};
};

preferAttributeRule.ruleName = preferAttributeName;
preferAttributeRule.messages = preferAttributeMessages;
preferAttributeRule.meta = { url: META_URL };

const layerDisciplineName = "otm/layer-discipline";

const layerDisciplineMessages = stylelint.utils.ruleMessages(
	layerDisciplineName,
	{
		unlayeredRuleInFile: (selector, layer) =>
			`Rule "${selector}" must be wrapped in "@layer ${layer} { ... }". Unlayered CSS overrides @layer state.`,
		wrongLayerInFile: (selector, actual, expected) =>
			`Rule "${selector}" is in "@layer ${actual}" inside ${expected}.css. Wrap it in "@layer ${expected} { ... }".`,
		unlayeredRuleInLayeredFile: (selector) =>
			`Unlayered rule "${selector}" overrides @layer state in a layered stylesheet. Wrap it in @layer structure, @layer style, or @layer state.`,
		stateSelectorInLayer: (token, layer) =>
			`State selector "${token}" is forbidden in @layer ${layer}. Move state-driven rules to state.css.`,
		stylePropInStructure: (prop) =>
			`Stylistic property "${prop}" belongs in style.css, not structure.css.`,
		structurePropInStyle: (prop) =>
			`Structural layout property "${prop}" belongs in structure.css, not style.css.`,
		unconditionalInState: (selector) =>
			`Unconditional selector "${selector}" does not belong in state.css. Move baseline layout/skin rules to structure.css or style.css.`,
	},
);

const STYLE_ONLY_PROPS = new Set([
	"color",
	"background",
	"background-color",
	"background-image",
	"font-family",
	"box-shadow",
	"text-shadow",
	"fill",
	"stroke",
	"accent-color",
	"text-decoration",
	"text-decoration-color",
	"border",
	"border-top",
	"border-right",
	"border-bottom",
	"border-left",
	"border-block",
	"border-block-start",
	"border-block-end",
	"border-inline",
	"border-inline-start",
	"border-inline-end",
	"border-color",
	"border-top-color",
	"border-right-color",
	"border-bottom-color",
	"border-left-color",
	"border-block-color",
	"border-block-start-color",
	"border-block-end-color",
	"border-inline-color",
	"border-inline-start-color",
	"border-inline-end-color",
	"border-style",
	"border-radius",
	"outline",
	"outline-color",
	"outline-style",
]);

const STRUCTURE_ONLY_PROPS = new Set([
	"display",
	"grid",
	"grid-template",
	"grid-template-columns",
	"grid-template-rows",
	"grid-template-areas",
	"grid-area",
	"grid-column",
	"grid-column-start",
	"grid-column-end",
	"grid-row",
	"grid-row-start",
	"grid-row-end",
	"grid-auto-flow",
	"grid-auto-columns",
	"grid-auto-rows",
	"flex",
	"flex-grow",
	"flex-shrink",
	"flex-basis",
	"flex-direction",
	"flex-wrap",
	"flex-flow",
	"justify-content",
	"justify-items",
	"justify-self",
	"align-items",
	"align-content",
	"align-self",
	"place-items",
	"place-content",
	"place-self",
	"order",
	"gap",
	"row-gap",
	"column-gap",
	"position",
	"inset",
	"inset-block",
	"inset-block-start",
	"inset-block-end",
	"inset-inline",
	"inset-inline-start",
	"inset-inline-end",
	"top",
	"right",
	"bottom",
	"left",
	"z-index",
]);

const NATIVE_STATE_ATTRS = new Set([
	"open",
	"hidden",
	"disabled",
	"checked",
	"selected",
	"readonly",
	"required",
]);

const DOM_STATE_PSEUDOS = new Set([
	":checked",
	":disabled",
	":enabled",
	":invalid",
	":valid",
	":user-invalid",
	":user-valid",
	":indeterminate",
	":open",
	":popover-open",
	":modal",
	":fullscreen",
	":target",
	":empty",
]);

const INTERACTIVE_PSEUDOS = new Set([
	":focus",
	":focus-visible",
	":focus-within",
	":hover",
	":active",
]);

const APP_LAYERS = new Set(["structure", "style", "state"]);
const LAYER_IMPORT_RE =
	/(?:on_the_money\/css|(?:^|[/\\"'-])(?:schema|scheme|structure|style|state)\.css)/i;

const detectLayer = (from) => {
	if (!from) return null;
	const base = path.basename(from).toLowerCase();
	if (/^(?:.*-)?structure\.css$/.test(base)) return "structure";
	if (/^(?:.*-)?style\.css$/.test(base)) return "style";
	if (/^(?:.*-)?state\.css$/.test(base)) return "state";
	return null;
};

const isStateAttr = (name) =>
	name.startsWith("data-") || name.startsWith("aria-");

const insideKeyframes = (node) => {
	let cur = node.parent;
	while (cur) {
		if (cur.type === "atrule" && cur.name.toLowerCase().endsWith("keyframes")) {
			return true;
		}
		cur = cur.parent;
	}
	return false;
};

const isNestedRule = (rule) => {
	let cur = rule.parent;
	while (cur) {
		if (cur.type === "rule") return true;
		cur = cur.parent;
	}
	return false;
};

const enclosingRootLayer = (node) => {
	let outermost = null;
	let cur = node.parent;
	while (cur) {
		if (cur.type === "atrule" && cur.name.toLowerCase() === "layer") {
			const name = cur.params.trim();
			outermost = name ? name.split(".")[0].trim().toLowerCase() : "";
		}
		cur = cur.parent;
	}
	return outermost;
};

const fileOptsIntoLayers = (root) => {
	let layered = false;
	root.walkAtRules((atRule) => {
		if (layered) return;
		const name = atRule.name.toLowerCase();
		if (name === "layer") {
			layered = true;
		} else if (name === "import" && LAYER_IMPORT_RE.test(atRule.params)) {
			layered = true;
		}
	});
	return layered;
};

const singleSelectorHasState = (selectorNode) => {
	let found = false;
	selectorNode.walkAttributes((attr) => {
		const lower = attr.attribute.toLowerCase();
		if (isStateAttr(lower) || NATIVE_STATE_ATTRS.has(lower)) {
			found = true;
		}
	});
	if (!found) {
		selectorNode.walkPseudos((pseudo) => {
			const lower = pseudo.value.toLowerCase();
			if (DOM_STATE_PSEUDOS.has(lower) || INTERACTIVE_PSEUDOS.has(lower)) {
				found = true;
			}
		});
	}
	return found;
};

const selectorHasState = (selectorText) => {
	let allStateful = true;
	selectorParser((selectors) => {
		if (selectors.nodes.length === 0) {
			allStateful = false;
			return;
		}
		for (const sel of selectors.nodes) {
			if (!singleSelectorHasState(sel)) {
				allStateful = false;
				return;
			}
		}
	}).processSync(selectorText);
	return allStateful;
};

const ruleOrAncestorHasState = (rule) => {
	let cur = rule;
	while (cur) {
		if (cur.type === "rule" && selectorHasState(cur.selector)) {
			return true;
		}
		cur = cur.parent;
	}
	return false;
};

const checkDisallowedStateSelectors = (rule, layer, result) => {
	selectorParser((selectors) => {
		selectors.walkAttributes((attr) => {
			const lower = attr.attribute.toLowerCase();
			if (isStateAttr(lower) || NATIVE_STATE_ATTRS.has(lower)) {
				stylelint.utils.report({
					message: layerDisciplineMessages.stateSelectorInLayer(
						`[${attr.attribute}]`,
						layer,
					),
					node: rule,
					result,
					ruleName: layerDisciplineName,
				});
			}
		});
		selectors.walkPseudos((pseudo) => {
			const lower = pseudo.value.toLowerCase();
			if (
				DOM_STATE_PSEUDOS.has(lower) ||
				(layer === "structure" && INTERACTIVE_PSEUDOS.has(lower))
			) {
				stylelint.utils.report({
					message: layerDisciplineMessages.stateSelectorInLayer(
						pseudo.value,
						layer,
					),
					node: rule,
					result,
					ruleName: layerDisciplineName,
				});
			}
		});
	}).processSync(rule.selector);
};

const layerDisciplineRule = (primary) => {
	return (root, result) => {
		const validOptions = stylelint.utils.validateOptions(
			result,
			layerDisciplineName,
			{
				actual: primary,
				possible: [true, false],
			},
		);
		if (!validOptions || !primary) return;

		const fileLayer = detectLayer(result.opts.from);
		const layeredFile = fileLayer !== null || fileOptsIntoLayers(root);

		root.walkRules((rule) => {
			if (insideKeyframes(rule)) return;

			const declaredLayer = enclosingRootLayer(rule);
			const nested = isNestedRule(rule);

			if (fileLayer !== null) {
				if (!nested) {
					if (declaredLayer === null) {
						stylelint.utils.report({
							message: layerDisciplineMessages.unlayeredRuleInFile(
								rule.selector,
								fileLayer,
							),
							node: rule,
							result,
							ruleName: layerDisciplineName,
						});
					} else if (declaredLayer !== fileLayer) {
						stylelint.utils.report({
							message: layerDisciplineMessages.wrongLayerInFile(
								rule.selector,
								declaredLayer || "(anonymous)",
								fileLayer,
							),
							node: rule,
							result,
							ruleName: layerDisciplineName,
						});
					}
				}
			} else if (declaredLayer === null && layeredFile && !nested) {
				stylelint.utils.report({
					message: layerDisciplineMessages.unlayeredRuleInLayeredFile(
						rule.selector,
					),
					node: rule,
					result,
					ruleName: layerDisciplineName,
				});
			}

			const effectiveLayer =
				fileLayer ??
				(declaredLayer && APP_LAYERS.has(declaredLayer) ? declaredLayer : null);
			if (!effectiveLayer) return;

			if (effectiveLayer === "structure" || effectiveLayer === "style") {
				checkDisallowedStateSelectors(rule, effectiveLayer, result);

				rule.each((child) => {
					if (child.type !== "decl") return;
					const prop = child.prop.toLowerCase();
					if (effectiveLayer === "structure" && STYLE_ONLY_PROPS.has(prop)) {
						stylelint.utils.report({
							message: layerDisciplineMessages.stylePropInStructure(child.prop),
							node: child,
							result,
							ruleName: layerDisciplineName,
						});
					} else if (
						effectiveLayer === "style" &&
						STRUCTURE_ONLY_PROPS.has(prop)
					) {
						stylelint.utils.report({
							message: layerDisciplineMessages.structurePropInStyle(child.prop),
							node: child,
							result,
							ruleName: layerDisciplineName,
						});
					}
				});
			} else if (effectiveLayer === "state") {
				if (!ruleOrAncestorHasState(rule)) {
					stylelint.utils.report({
						message: layerDisciplineMessages.unconditionalInState(
							rule.selector,
						),
						node: rule,
						result,
						ruleName: layerDisciplineName,
					});
				}
			}
		});
	};
};

layerDisciplineRule.ruleName = layerDisciplineName;
layerDisciplineRule.messages = layerDisciplineMessages;
layerDisciplineRule.meta = { url: META_URL };

export default [
	stylelint.createPlugin(preferAttributeName, preferAttributeRule),
	stylelint.createPlugin(layerDisciplineName, layerDisciplineRule),
];
