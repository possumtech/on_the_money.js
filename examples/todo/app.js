import { $, $$, on, the } from "../../src/core/index.js";

await the.boot({
	dictionary: {
		app_title: "onTheMoney • Todo",
		btn_add: "Add",
		items_left: {
			one: "1 item left",
			other: "{qty} items left",
		},
	},
});

const updateCount = () => {
	const count = $$("#todo-list [data-item]").filter(
		(el) => el.getAttribute("aria-checked") === "false",
	).length;
	const footer = $('footer [data-i18n="items_left"]');
	footer.setAttribute("data-i18n-qty", count);
	the.t();
};

on("#todo-form", "submit", (e) => {
	e.preventDefault();
	const { task } = the.form(e.target);
	if (!task?.trim()) return;
	the($.clone("#todo-list", "#todo-item"), { task });
	$("#todo-input").value = "";
	updateCount();
});

on("#todo-list", "change", '[data-action="toggle-todo"]', (_e, target) => {
	the(target.closest("[data-item]"), "checked", String(target.checked));
	updateCount();
});

on("#todo-list", "click", '[data-action="delete-todo"]', (_e, target) => {
	target.closest("[data-item]").remove();
	updateCount();
});

updateCount();
