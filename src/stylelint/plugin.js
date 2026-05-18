import selectorParser from "postcss-selector-parser";
import stylelint from "stylelint";

const ruleName = "otm/prefer-attribute-selector";

const messages = stylelint.utils.ruleMessages(ruleName, {
	rejected: (cls) =>
		`Class selector "${cls}" is forbidden. Use an attribute selector like [data-state="..."] instead.`,
});

const meta = {
	url: "https://github.com/possumtech/on_the_money.js",
};

const ruleFunction = (primary) => {
	return (root, result) => {
		const validOptions = stylelint.utils.validateOptions(result, ruleName, {
			actual: primary,
			possible: [true, false],
		});
		if (!validOptions || !primary) return;

		root.walkRules((rule) => {
			selectorParser((selectors) => {
				selectors.walkClasses((classNode) => {
					stylelint.utils.report({
						message: messages.rejected(`.${classNode.value}`),
						node: rule,
						result,
						ruleName,
					});
				});
			}).processSync(rule.selector);
		});
	};
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;

export default stylelint.createPlugin(ruleName, ruleFunction);
