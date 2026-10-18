import assert from "node:assert/strict";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import { _t, the } from "./index.js";

for (const scope of ["global", "scoped", "self"]) {
	test(`projection preserves existing text nodes after scalar normalization (${scope})`, async () => {
		const { document } = setupDOM(
			'<article><code data-text="value">Source</code></article>',
		);
		await the.boot({ locale: "en", persistKeys: [] });
		const target = document.querySelector("code");
		const owner = scope === "self" ? target : document.querySelector("article");
		const write = (value) =>
			scope === "global" ? the("value", value) : the(owner, "value", value);
		for (const value of ["Assistant", 0, 42, true, false, ""]) {
			write(value);
			const text = String(value);
			target.replaceChildren(
				document.createTextNode(text.slice(0, 1)),
				document.createTextNode(text.slice(1)),
			);
			const nodes = [...target.childNodes];
			write(value);
			write(text);
			assert.equal(target.textContent, text);
			assert.equal(target.childNodes.length, 2);
			assert.ok(nodes.every((node, i) => node === target.childNodes[i]));
		}
	});
}

for (const scope of ["global", "scoped"]) {
	test(`projection repairs each live binding even when owner state is unchanged (${scope})`, async () => {
		const { document } = setupDOM(
			'<article><strong data-text="label">Source</strong><a data-bind="title:label">Link</a></article>',
		);
		await the.boot({ locale: "en", persistKeys: [] });
		const owner = document.querySelector("article");
		const write = (value) =>
			scope === "global" ? the({ label: value }) : the(owner, { label: value });
		const target = document.querySelector("strong");
		const link = document.querySelector("a");
		write("Assistant");
		const node = target.firstChild;
		const fresh = document.createElement("span");
		fresh.setAttribute("data-text", "label");
		fresh.setAttribute("data-bind", "title:label");
		owner.append(fresh);
		link.setAttribute("title", "Drift");
		write("Assistant");
		assert.equal(fresh.textContent, "Assistant");
		assert.equal(fresh.getAttribute("title"), "Assistant");
		assert.equal(link.getAttribute("title"), "Assistant");
		assert.ok(target.firstChild === node);
		fresh.textContent = "Drift";
		write("Assistant");
		assert.equal(fresh.textContent, "Assistant");
		write("User");
		assert.equal(target.textContent, "User");
		assert.equal(fresh.textContent, "User");
		assert.equal(link.getAttribute("title"), "User");
		write(null);
		assert.equal(
			the(scope === "global" ? document.body : owner, "label"),
			null,
		);
		assert.equal(target.textContent, "");
		assert.equal(fresh.textContent, "");
		assert.equal(link.getAttribute("title"), null);
		assert.equal(fresh.getAttribute("title"), null);
		fresh.textContent = "Late source";
		fresh.setAttribute("title", "Late source");
		write(null);
		assert.equal(fresh.textContent, "");
		assert.equal(fresh.getAttribute("title"), null);
		write("");
		assert.equal(the(scope === "global" ? document.body : owner, "label"), "");
		assert.equal(link.getAttribute("title"), "");
	});
}

test("localization preserves matching text independently of language and source restoration", async () => {
	const { document } = setupDOM(
		'<strong data-i18n="label" lang="en-GB">Assistant</strong>',
	);
	const target = document.querySelector("strong");
	const node = target.firstChild;
	await the.boot({
		locale: "fr",
		dictionary: { label: "Assistant" },
		persistKeys: [],
	});
	assert.ok(target.firstChild === node);
	assert.equal(target.lang, "fr");
	_t(target);
	assert.ok(target.firstChild === node);
	await the.boot({
		locale: "de",
		dictionary: { label: "Assistant" },
		persistKeys: [],
	});
	assert.equal(target.lang, "de");
	assert.ok(target.firstChild === node);
	the.dictionary = {};
	_t();
	_t();
	assert.equal(target.textContent, "Assistant");
	assert.equal(target.lang, "en-GB");
	assert.ok(target.firstChild === node);
	the.dictionary = { label: "Changed" };
	_t();
	assert.equal(target.textContent, "Changed");
	assert.equal(target.lang, "de");
	the.dictionary = {};
	_t();
	assert.equal(target.textContent, "Assistant");
	assert.equal(target.lang, "en-GB");
});

test("unchanged DOM state still repairs opted-in storage and preserves storage failures", async (t) => {
	const { document } = setupDOM('<span data-text="label">Source</span>');
	await the.boot({ locale: "en", persistKeys: ["label"] });
	the("label", "Assistant");
	const node = document.querySelector("span").firstChild;
	localStorage.clear();
	the("label", "Assistant");
	assert.equal(localStorage.getItem("otm:label"), "Assistant");
	assert.ok(document.querySelector("span").firstChild === node);
	const cause = new Error("Storage unavailable");
	t.mock.method(localStorage, "setItem", () => {
		throw cause;
	});
	assert.throws(
		() => the("label", "Assistant"),
		(error) => error === cause,
	);
});
