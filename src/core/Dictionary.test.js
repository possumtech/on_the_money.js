import assert from "node:assert/strict";
import test from "node:test";
import Dictionary from "./Dictionary.js";

test("dictionary validation preserves valid strings and plural entries", () => {
	const dictionary = {
		empty: "",
		title: "Hello",
		count: { one: "One", other: "Many" },
	};
	assert.equal(Dictionary.validate(dictionary), dictionary);
	assert.deepEqual(Dictionary.validate({}), {});
});

for (const value of [null, [], 1, "text"]) {
	test(`dictionary rejects non-record ${JSON.stringify(value)}`, () => {
		assert.throws(() => Dictionary.validate(value), {
			name: "TypeError",
			message: "i18n dictionary must be an object",
		});
	});
}

for (const entry of [
	null,
	[],
	1,
	{},
	{ one: "One" },
	{ other: 2 },
	{ invalid: "Invalid", other: "Many" },
]) {
	test(`dictionary rejects invalid entry ${JSON.stringify(entry)}`, () => {
		assert.throws(() => Dictionary.validate({ count: entry }), {
			name: "TypeError",
			message: /dictionary entry "count"/,
		});
	});
}
