import assert from "node:assert/strict";
import test from "node:test";
import { $, the } from "../core/index.js";
import { setupDOM } from "../test/index.js";
import { combobox } from "./index.js";

const MARKUP = `
	<input
		id="model-input"
		type="text"
		role="combobox"
		aria-controls="model-list"
		aria-expanded="false"
		aria-autocomplete="list"
	>
	<ul id="model-list" role="listbox" aria-label="Models">
		<li id="opt-a" role="option" data-value="a">Alpha</li>
		<li role="option" data-value="b" aria-disabled="true">Beta (disabled)</li>
		<li role="option" data-value="c">Gamma</li>
		<li role="option" data-value="d" hidden>Delta (hidden)</li>
		<li role="option" data-value="e">Epsilon</li>
	</ul>
`;

const domEvent = (type, init = {}, extra = {}) => {
	const EventCtor = window.Event || CustomEvent;
	const ev = new EventCtor(type, init);
	Object.assign(ev, extra);
	return ev;
};

const keyEvent = (key, extra = {}) =>
	domEvent("keydown", { bubbles: true, cancelable: true }, { key, ...extra });

test("combobox: fails fast on missing target, wrong role, broken aria-controls, or auto popover", () => {
	setupDOM(`
		<input id="no-role" aria-controls="lb">
		<input id="no-controls" role="combobox" aria-expanded="false">
		<input id="missing-lb" role="combobox" aria-controls="ghost" aria-expanded="false">
		<input id="wrong-lb" role="combobox" aria-controls="not-lb" aria-expanded="false">
		<div id="not-lb"></div>
		<input id="auto-pop" role="combobox" aria-controls="pop-lb" aria-expanded="false">
		<ul id="pop-lb" role="listbox" aria-label="Pop" popover></ul>
	`);

	assert.throws(() => combobox("#missing"), TypeError);
	assert.throws(() => combobox("#no-role"), /role="combobox"/);
	assert.throws(() => combobox("#no-controls"), /aria-controls/);
	assert.throws(() => combobox("#missing-lb"), /aria-controls="ghost"/);
	assert.throws(() => combobox("#wrong-lb"), /role="listbox"/);
	assert.throws(() => combobox("#auto-pop"), /popover="manual"/);
});

test("combobox: APG keyboard navigation, wrapping, disabled/hidden skipping, Enter selection, and Escape", () => {
	const { document } = setupDOM(MARKUP);
	const input = document.getElementById("model-input");
	const listbox = document.getElementById("model-list");
	const events = [];

	const ctrl = combobox("#model-input", {
		onOpen: () => events.push("open"),
		onClose: () => events.push("close"),
		onSelect: (opt, el) => {
			el.value = opt.textContent;
			events.push(`select:${opt.dataset.value}`);
		},
	});

	assert.equal(ctrl.expanded, false);
	assert.equal(listbox.hidden, true);
	assert.equal(input.getAttribute("aria-expanded"), "false");

	// ArrowDown opens and activates first available option (Alpha)
	const down1 = keyEvent("ArrowDown");
	input.dispatchEvent(down1);
	assert.equal(down1.defaultPrevented, true);
	assert.equal(ctrl.expanded, true);
	assert.equal(listbox.hidden, false);
	assert.equal(input.getAttribute("aria-expanded"), "true");
	assert.equal(input.getAttribute("aria-activedescendant"), "opt-a");
	assert.equal(
		document.getElementById("opt-a").getAttribute("data-active"),
		"true",
	);

	// Next ArrowDown skips aria-disabled Beta and lands on auto-ID'd Gamma
	input.dispatchEvent(keyEvent("ArrowDown"));
	const gamma = listbox.querySelector('[data-value="c"]');
	assert.ok(gamma.id.startsWith("model-list-opt-"));
	assert.equal(input.getAttribute("aria-activedescendant"), gamma.id);
	assert.equal(gamma.getAttribute("data-active"), "true");
	assert.equal(
		document.getElementById("opt-a").getAttribute("data-active"),
		null,
	);

	// Next ArrowDown skips hidden Delta and lands on Epsilon
	input.dispatchEvent(keyEvent("ArrowDown"));
	const epsilon = listbox.querySelector('[data-value="e"]');
	assert.equal(input.getAttribute("aria-activedescendant"), epsilon.id);

	// Next ArrowDown wraps back to Alpha
	input.dispatchEvent(keyEvent("ArrowDown"));
	assert.equal(input.getAttribute("aria-activedescendant"), "opt-a");

	// ArrowUp wraps to Epsilon
	input.dispatchEvent(keyEvent("ArrowUp"));
	assert.equal(input.getAttribute("aria-activedescendant"), epsilon.id);

	// Home/End on editable <input> preserve native caret (not prevented) and return visual focus to input
	const home = keyEvent("Home");
	input.dispatchEvent(home);
	assert.equal(home.defaultPrevented, false);
	assert.equal(input.getAttribute("aria-activedescendant"), null);
	assert.equal(ctrl.activeOption, null);

	// Enter with no active option does not preventDefault (allows form submit)
	const enterIdle = keyEvent("Enter");
	input.dispatchEvent(enterIdle);
	assert.equal(enterIdle.defaultPrevented, false);

	// ArrowDown + Enter commits Alpha, sets aria-selected, closes listbox
	input.dispatchEvent(keyEvent("ArrowDown"));
	const enterPick = keyEvent("Enter");
	input.dispatchEvent(enterPick);
	assert.equal(enterPick.defaultPrevented, true);
	assert.equal(ctrl.expanded, false);
	assert.equal(listbox.hidden, true);
	assert.equal(
		document.getElementById("opt-a").getAttribute("aria-selected"),
		"true",
	);
	assert.equal(input.value, "Alpha");

	// Escape while closed clears input value and fires input event without re-opening listbox
	let inputFired = 0;
	input.addEventListener("input", () => {
		inputFired += 1;
	});
	const escClear = keyEvent("Escape");
	input.dispatchEvent(escClear);
	assert.equal(escClear.defaultPrevented, true);
	assert.equal(input.value, "");
	assert.equal(inputFired, 1);
	assert.equal(ctrl.expanded, false);

	// Alt+ArrowDown opens without activating an option; Alt+ArrowUp closes
	input.dispatchEvent(keyEvent("ArrowDown", { altKey: true }));
	assert.equal(ctrl.expanded, true);
	assert.equal(ctrl.activeOption, null);
	input.dispatchEvent(keyEvent("ArrowUp", { altKey: true }));
	assert.equal(ctrl.expanded, false);

	assert.deepEqual(events, ["open", "close", "select:a", "open", "close"]);
});

test("combobox: wrap=false clamps bounds, IME composition is ignored, and Tab closes without trapping focus", () => {
	const { document } = setupDOM(MARKUP);
	const input = document.getElementById("model-input");
	const ctrl = combobox(input, { wrap: false, clearOnEscape: false });

	// Closed ArrowUp opens and lands on last available option (Epsilon)
	input.dispatchEvent(keyEvent("ArrowUp"));
	const epsilon = document.querySelector('[data-value="e"]');
	assert.equal(ctrl.activeOption, epsilon);

	// Further ArrowDown clamps at Epsilon
	input.dispatchEvent(keyEvent("ArrowDown"));
	assert.equal(ctrl.activeOption, epsilon);

	// Composing Enter is ignored
	const composing = keyEvent("Enter", { isComposing: true });
	input.dispatchEvent(composing);
	assert.equal(composing.defaultPrevented, false);
	assert.equal(ctrl.expanded, true);

	// Tab closes without preventing default
	const tab = keyEvent("Tab");
	input.dispatchEvent(tab);
	assert.equal(tab.defaultPrevented, false);
	assert.equal(ctrl.expanded, false);

	// clearOnEscape=false leaves value intact
	input.value = "keep";
	const esc = keyEvent("Escape");
	input.dispatchEvent(esc);
	assert.equal(esc.defaultPrevented, false);
	assert.equal(input.value, "keep");
});

test("combobox: pointer selection, hidden group skipping, dynamic $.reconcile + sync(), and AbortSignal teardown", () => {
	const { document } = setupDOM(`
		<input id="pick" type="text" role="combobox" aria-controls="pick-list" aria-expanded="false">
		<ul id="pick-list" role="listbox" aria-label="Items"></ul>
		<template id="opt-tpl"><li role="option" data-text="label"></li></template>
	`);
	const input = document.getElementById("pick");
	const listbox = document.getElementById("pick-list");
	const ac = new AbortController();
	const picked = [];

	const render = (items) =>
		$.reconcile(listbox, "#opt-tpl", items, {
			key: (item) => item.id,
			fill: (el, item) => the(el, { label: item.label }),
		});

	render([
		{ id: "1", label: "First" },
		{ id: "2", label: "Second" },
	]);

	const ctrl = combobox(input, {
		signal: ac.signal,
		onSelect: (opt) => picked.push(opt.getAttribute("data-otm-key")),
	});

	ctrl.open();
	input.dispatchEvent(keyEvent("ArrowDown"));
	assert.equal(ctrl.activeOption.getAttribute("data-otm-key"), "1");

	// Remove active item via $.reconcile and call sync() -> clears stale aria-activedescendant
	render([{ id: "2", label: "Second" }]);
	ctrl.sync();
	assert.equal(ctrl.activeOption, null);
	assert.equal(input.getAttribute("aria-activedescendant"), null);

	// Clicking option selects it and updates aria-selected
	const second = listbox.querySelector('[data-otm-key="2"]');
	const down = domEvent("mousedown", { bubbles: true, cancelable: true });
	second.dispatchEvent(down);
	assert.equal(down.defaultPrevented, true);
	second.click();
	assert.deepEqual(picked, ["2"]);
	assert.equal(second.getAttribute("aria-selected"), "true");

	// Outside mousedown dismisses when open
	ctrl.open();
	assert.equal(ctrl.expanded, true);
	document.body.dispatchEvent(domEvent("mousedown", { bubbles: true }));
	assert.equal(ctrl.expanded, false);

	// Hidden parent group makes nested options unavailable
	const group = document.createElement("div");
	group.setAttribute("role", "group");
	group.hidden = true;
	const groupedOpt = document.createElement("div");
	groupedOpt.setAttribute("role", "option");
	groupedOpt.textContent = "Grouped";
	group.append(groupedOpt);
	listbox.append(group);
	ctrl.open();
	input.dispatchEvent(keyEvent("ArrowDown"));
	assert.equal(ctrl.activeOption, second);
	input.dispatchEvent(keyEvent("ArrowDown"));
	assert.equal(ctrl.activeOption, second);

	// Invalid option argument throws before disposal
	assert.throws(() => ctrl.select(document.body), TypeError);

	// Blur to an external element closes the listbox; blur into listbox stays open
	ctrl.open();
	const blurInto = domEvent("blur", {}, { relatedTarget: second });
	input.dispatchEvent(blurInto);
	assert.equal(ctrl.expanded, true);
	const blurOut = domEvent("blur", {}, { relatedTarget: document.body });
	input.dispatchEvent(blurOut);
	assert.equal(ctrl.expanded, false);

	// AbortSignal disposes cleanly (subsequent API calls are no-ops)
	ctrl.open();
	ac.abort();
	assert.equal(input.getAttribute("aria-activedescendant"), null);
	ctrl.close();
	ctrl.open();
	assert.equal(ctrl.expanded, true);
});

test('combobox: supports popover="manual" listboxes via native showPopover/hidePopover', () => {
	const { document } = setupDOM(`
		<input id="p-in" type="text" role="combobox" aria-controls="p-list" aria-expanded="false">
		<ul id="p-list" role="listbox" aria-label="Models" popover="manual">
			<li role="option">One</li>
		</ul>
	`);
	const listbox = document.getElementById("p-list");
	let openState = false;
	const calls = [];
	listbox.showPopover = () => {
		openState = true;
		calls.push("show");
	};
	listbox.hidePopover = () => {
		openState = false;
		calls.push("hide");
	};
	const origMatches = listbox.matches.bind(listbox);
	listbox.matches = (sel) =>
		sel === ":popover-open" ? openState : origMatches(sel);

	const ctrl = combobox("#p-in");
	assert.equal(listbox.hidden, false);
	ctrl.open();
	ctrl.close();
	assert.deepEqual(calls, ["show", "hide"]);
});

test("combobox: select-only non-input combobox supports Home/End/Space/click toggle", () => {
	const { document } = setupDOM(`
		<button id="sel" type="button" role="combobox" aria-controls="sel-list" aria-expanded="false">Choose</button>
		<ul id="sel-list" role="listbox" aria-label="Choices">
			<li role="option">One</li>
			<li role="option">Two</li>
			<li role="option">Three</li>
		</ul>
	`);
	const btn = document.getElementById("sel");
	const picked = [];
	const ctrl = combobox(btn, {
		openOnFocus: false,
		onSelect: (opt) => picked.push(opt.textContent),
	});

	// Click toggles open and closed
	btn.click();
	assert.equal(ctrl.expanded, true);
	btn.click();
	assert.equal(ctrl.expanded, false);

	// Space opens; End jumps to last; Home jumps to first; Space selects
	btn.dispatchEvent(keyEvent(" "));
	assert.equal(ctrl.expanded, true);
	const end = keyEvent("End");
	btn.dispatchEvent(end);
	assert.equal(end.defaultPrevented, true);
	assert.equal(ctrl.activeOption.textContent, "Three");
	const home = keyEvent("Home");
	btn.dispatchEvent(home);
	assert.equal(home.defaultPrevented, true);
	assert.equal(ctrl.activeOption.textContent, "One");
	btn.dispatchEvent(keyEvent(" "));
	assert.deepEqual(picked, ["One"]);
	assert.equal(ctrl.expanded, false);
});

test("combobox: pre-aborted signal returns disposed controller without attaching listeners", () => {
	setupDOM(MARKUP);
	const ac = new AbortController();
	ac.abort();
	const ctrl = combobox("#model-input", { signal: ac.signal });
	ctrl.open();
	assert.equal(ctrl.expanded, false);
});
