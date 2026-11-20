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
		stateSelectorInLayer: (attr, layer) =>
			`State selector "${attr}" is forbidden in ${layer}.css. Move state-driven rules to state.css.`,
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
	"border-color",
	"outline-color",
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
	"grid-row",
	"grid-auto-flow",
	"grid-auto-columns",
	"grid-auto-rows",
	"flex",
	"flex-direction",
	"flex-wrap",
	"flex-flow",
	"justify-content",
	"justify-items",
	"align-items",
	"align-content",
	"place-items",
	"place-content",
	"gap",
	"row-gap",
	"column-gap",
	"position",
	"inset",
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

const STATE_PSEUDOS = new Set([
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
	":focus",
	":focus-visible",
	":focus-within",
	":hover",
	":active",
	":has",
]);

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

const selectorHasState = (selectorText) => {
	let found = false;
	selectorParser((selectors) => {
		selectors.walkAttributes((attr) => {
			const lower = attr.attribute.toLowerCase();
			if (isStateAttr(lower) || NATIVE_STATE_ATTRS.has(lower)) {
				found = true;
			}
		});
		if (!found) {
			selectors.walkPseudos((pseudo) => {
				if (STATE_PSEUDOS.has(pseudo.value.toLowerCase())) {
					found = true;
				}
			});
		}
	}).processSync(selectorText);
	return found;
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

		const layer = detectLayer(result.opts.from);
		if (!layer) return;

		root.walkRules((rule) => {
			if (insideKeyframes(rule)) return;

			if (layer === "structure" || layer === "style") {
				selectorParser((selectors) => {
					selectors.walkAttributes((attr) => {
						const lower = attr.attribute.toLowerCase();
						if (isStateAttr(lower)) {
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
				}).processSync(rule.selector);

				rule.each((child) => {
					if (child.type !== "decl") return;
					const prop = child.prop.toLowerCase();
					if (layer === "structure" && STYLE_ONLY_PROPS.has(prop)) {
						stylelint.utils.report({
							message: layerDisciplineMessages.stylePropInStructure(child.prop),
							node: child,
							result,
							ruleName: layerDisciplineName,
						});
					} else if (layer === "style" && STRUCTURE_ONLY_PROPS.has(prop)) {
						stylelint.utils.report({
							message: layerDisciplineMessages.structurePropInStyle(child.prop),
							node: child,
							result,
							ruleName: layerDisciplineName,
						});
					}
				});
			} else if (layer === "state") {
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
