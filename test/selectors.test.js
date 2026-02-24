import assert from "node:assert";
import test from "node:test";
import { parseHTML } from "linkedom";
import Select from "../src/core/Select.js";
import The from "../src/core/The.js";

const setupDOM = (html = "") => {
	const dom = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
	globalThis.document = dom.document;
	globalThis.Node = dom.Node;
	return dom.document;
};

test("Select.$: should find element in document by default", (_t) => {
	setupDOM('<div class="find-me"></div>');
	const el = Select.$(".find-me");
	assert.ok(el);
	assert.strictEqual(el.className, "find-me");
});

test("Select.$: should find element within context", (_t) => {
	const dom = setupDOM(`
    <div class="parent">
      <span class="child"></span>
    </div>
    <span class="child" id="outside"></span>
  `);
	const parent = dom.querySelector(".parent");
	const child = Select.$(parent, ".child");
	assert.ok(child);
	assert.strictEqual(child.id, "");
});

test("Select.$$: should return real Array", (_t) => {
	setupDOM("<ul><li>1</li><li>2</li></ul>");
	const items = Select.$$("li");
	assert.ok(Array.isArray(items));
	assert.strictEqual(items.length, 2);
});

test("Select.clone: should clone template and return first element", (_t) => {
	setupDOM(`
    <template id="tmp">
      <div class="cloned">Hello</div>
    </template>
  `);
	const el = Select.clone("#tmp");
	assert.ok(el);
	assert.strictEqual(el.className, "cloned");
	assert.strictEqual(el.textContent, "Hello");
});

test("Select.clone: should hydrate i18n inside the clone", (_t) => {
	setupDOM(`
    <template id="tmp">
      <div data-i18n="greeting"></div>
    </template>
  `);
	The.dictionary = { greeting: "Bonjour" };
	const el = Select.clone("#tmp");
	assert.strictEqual(el.textContent, "Bonjour");
});

test("Select.clone: should throw if template not found", (_t) => {
	setupDOM("");
	assert.throws(() => {
		Select.clone("#missing");
	});
});
