// Dogfood: consume the shipped config exactly as a consumer would
// (package self-reference). Framework internals are exempt by design —
// they implement the sanctioned primitives; examples/ must be clean.
import otm from "on_the_money/eslint-config";

export default [
	{
		ignores: ["src/**", "test/**", "dist/**", "fixtures/**"],
	},
	...otm,
];
