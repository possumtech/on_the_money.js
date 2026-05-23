import plugin from "./plugin.js";

const recommended = [
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}"],
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
];

export default recommended;
