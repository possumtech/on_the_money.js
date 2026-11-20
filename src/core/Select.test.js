import assert from "node:assert";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import Select from "./Select.js";
import The from "./The.js";

test("Select.$: should find element in document by default", (_t) => {
	setupDOM('<div class="find-me"></div>');
	const el = Select.$(".find-me");
	assert.ok(el);
	assert.strictEqual(el.className, "find-me");
});

test("Select.$: should find element within context", (_t) => {
	const { document: dom } = setupDOM(`
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
	const { document: dom } = setupDOM(`
    <div id="mount"></div>
    <template id="tmp">
      <div class="cloned">Hello</div>
    </template>
  `);
	const el = Select.clone("#mount", "#tmp");
	assert.ok(el);
	assert.strictEqual(el.className, "cloned");
	assert.strictEqual(el.textContent, "Hello");
	assert.strictEqual(dom.querySelector("#mount").firstElementChild, el);
});

test("Select.clone: should hydrate i18n inside the clone", (_t) => {
	setupDOM(`
    <div id="mount"></div>
    <template id="tmp">
      <div data-i18n="greeting"></div>
    </template>
  `);
	The.dictionary = { greeting: "Bonjour" };
	const el = Select.clone("#mount", "#tmp");
	assert.strictEqual(el.textContent, "Bonjour");
});

test("Select.clone: should throw if template not found", (_t) => {
	setupDOM('<div id="mount"></div>');
	assert.throws(
		() => Select.clone("#mount", "#missing"),
		/Template not found: #missing/,
	);
});

test("Select.clone: should throw if parent not found", (_t) => {
	setupDOM('<template id="tmp"><div></div></template>');
	assert.throws(
		() => Select.clone("#missing", "#tmp"),
		/Parent not found: #missing/,
	);
});

test("Select.clone: { position: 'afterbegin' } prepends instead of appending", (_t) => {
	const { document: dom } = setupDOM(`
		<ul id="list"><li id="existing"></li></ul>
		<template id="tmp"><li class="new"></li></template>
	`);
	const el = Select.clone("#list", "#tmp", { position: "afterbegin" });
	const list = dom.querySelector("#list");
	assert.strictEqual(list.firstElementChild, el);
	assert.strictEqual(list.children.length, 2);
});

test("Select.clone: { position: 'beforeend' } default appends", (_t) => {
	const { document: dom } = setupDOM(`
		<ul id="list"><li id="existing"></li></ul>
		<template id="tmp"><li class="new"></li></template>
	`);
	const el = Select.clone("#list", "#tmp");
	const list = dom.querySelector("#list");
	assert.strictEqual(list.lastElementChild, el);
});

test("Select.clone: { position: 'beforebegin' } inserts as sibling before reference", (_t) => {
	const { document: dom } = setupDOM(`
		<ul id="parent"><li id="anchor"></li></ul>
		<template id="tmp"><div class="sibling"></div></template>
	`);
	const anchor = dom.querySelector("#anchor");
	const el = Select.clone(anchor, "#tmp", { position: "beforebegin" });
	assert.strictEqual(anchor.previousElementSibling, el);
});

test("Select.cloneEach: clears, clones per item, fills with index, returns mounted", (_t) => {
	const { document: dom } = setupDOM(`
		<template id="row"><li data-item><span data-text="name"></span></li></template>
		<ul id="list"><li data-item>stale</li></ul>
	`);
	const out = Select.cloneEach(
		"#list",
		"#row",
		["a", "b", "c"],
		(el, item, i) => {
			The.the(el, { name: `${item}${i}` });
		},
	);
	const list = dom.querySelector("#list");
	assert.strictEqual(out.length, 3);
	assert.strictEqual(list.children.length, 3);
	assert.strictEqual(list.children[0].querySelector("span").textContent, "a0");
	assert.strictEqual(list.children[2].querySelector("span").textContent, "c2");
	assert.strictEqual(list.textContent.includes("stale"), false);
});

test("Select.cloneEach: empty items yields an empty container", (_t) => {
	const { document: dom } = setupDOM(`
		<template id="row"><li data-item></li></template>
		<ul id="list"><li data-item>stale</li></ul>
	`);
	const out = Select.cloneEach("#list", "#row", []);
	assert.deepStrictEqual(out, []);
	assert.strictEqual(dom.querySelector("#list").children.length, 0);
});

test("Select.reconcile: reuses keyed nodes across updates, insertions, removals, and reorderings", () => {
	const { document: dom } = setupDOM(`
		<template id="row"><li data-item><span data-text="name"></span></li></template>
		<ul id="list"><li data-item>stale placeholder</li></ul>
	`);
	const list = dom.querySelector("#list");
	const fill = (el, item, idx) => The.the(el, { name: `${item.label}:${idx}` });

	const first = Select.reconcile(
		list,
		"#row",
		[
			{ id: "a", label: "Alpha" },
			{ id: "b", label: "Beta" },
			{ id: "c", label: "Gamma" },
		],
		{ key: (x) => x.id, fill },
	);
	assert.strictEqual(first.length, 3);
	const [nodeA, nodeB, nodeC] = first;
	assert.strictEqual(nodeA.getAttribute("data-otm-key"), "a");
	assert.strictEqual(list.textContent.includes("stale"), false);

	// Reorder + drop "b" + insert "d" in middle: nodeA and nodeC MUST keep identity
	const second = Select.reconcile(
		list,
		"#row",
		[
			{ id: "c", label: "Gamma2" },
			{ id: "d", label: "Delta" },
			{ id: "a", label: "Alpha2" },
		],
		{ key: (x) => x.id, fill },
	);
	assert.strictEqual(second.length, 3);
	assert.strictEqual(second[0], nodeC);
	assert.strictEqual(second[2], nodeA);
	assert.strictEqual(list.children[0], nodeC);
	assert.strictEqual(list.children[1], second[1]);
	assert.strictEqual(list.children[2], nodeA);
	assert.strictEqual(nodeC.querySelector("span").textContent, "Gamma2:0");
	assert.strictEqual(second[1].querySelector("span").textContent, "Delta:1");
	assert.strictEqual(nodeA.querySelector("span").textContent, "Alpha2:2");
	assert.strictEqual(nodeB.parentNode, null);

	// Empty list clears cleanly
	assert.deepStrictEqual(
		Select.reconcile(list, "#row", [], { key: (x) => x.id, fill }),
		[],
	);
	assert.strictEqual(list.children.length, 0);
});

test("Select.reconcile: prefers native moveBefore when available and supports custom data-* attr", () => {
	const { document: dom } = setupDOM(`
		<template id="row"><li data-item></li></template>
		<ul id="list"></ul>
	`);
	const list = dom.querySelector("#list");
	const moved = [];
	list.moveBefore = (node, ref) => {
		moved.push(node.getAttribute("data-row-id"));
		list.insertBefore(node, ref);
	};

	Select.reconcile(list, "#row", ["x", "y"], {
		key: (id) => id,
		attr: "data-row-id",
	});
	assert.deepStrictEqual(moved, []);

	Select.reconcile(list, "#row", ["y", "x"], {
		key: (id) => id,
		attr: "data-row-id",
	});
	assert.deepStrictEqual(moved, ["y"]);
	assert.strictEqual(list.children[0].getAttribute("data-row-id"), "y");
	assert.strictEqual(list.children[1].getAttribute("data-row-id"), "x");
});

test("Select.reconcile: rejects invalid options, empty keys, and duplicate keys atomically", () => {
	const { document: dom } = setupDOM(`
		<template id="row"><li data-item></li></template>
		<ul id="list"><li data-otm-key="keep">Keep</li></ul>
	`);
	const list = dom.querySelector("#list");
	const keep = list.firstElementChild;

	assert.throws(
		() => Select.reconcile("#missing", "#row", [], { key: (x) => x }),
		/Parent not found/,
	);
	assert.throws(
		() => Select.reconcile(list, "#row", []),
		/options\.key must be a function/,
	);
	assert.throws(
		() => Select.reconcile(list, "#row", [], { key: (x) => x, attr: "id" }),
		/canonical data-\* attribute/,
	);
	assert.throws(
		() => Select.reconcile(list, "#row", [""], { key: (x) => x }),
		/non-empty key/,
	);
	assert.throws(
		() => Select.reconcile(list, "#row", ["a", "a"], { key: (x) => x }),
		/duplicate key "a"/,
	);
	// Atomic validation: container was not mutated on duplicate key error
	assert.strictEqual(list.children.length, 1);
	assert.strictEqual(list.firstElementChild, keep);
});
