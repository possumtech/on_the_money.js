import assert from "node:assert/strict";
import test from "node:test";
import Locale from "./Locale.js";

test("lookup walks variants, region, and script without dropping script prematurely", () => {
	assert.deepEqual(Locale.chain("fr-ca-u-nu-latn"), ["fr-CA", "fr"]);
	assert.deepEqual(Locale.chain("de-CH-1901"), ["de-CH-1901", "de-CH", "de"]);
	assert.deepEqual(Locale.chain("sr-Latn-RS"), ["sr-Latn-RS", "sr-Latn"]);
	assert.deepEqual(Locale.chain("sr-Cyrl-RS"), ["sr-Cyrl-RS", "sr-Cyrl", "sr"]);
	assert.deepEqual(Locale.chain("zh-Hant-TW"), ["zh-Hant-TW", "zh-Hant"]);
});

test("compatibility retains regional specificity but not a different language or script", () => {
	assert.equal(Locale.compatible("fr-CA", "fr"), true);
	assert.equal(Locale.compatible("sr-Latn", "sr"), false);
	assert.equal(Locale.compatible("sr-Cyrl", "sr"), true);
	assert.equal(Locale.compatible("fr-CA", "en"), false);
});
