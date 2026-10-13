import { $, $$, on, the } from "../../src/core/index.js";

await the.boot();

const updateCount = () => {
	const count = $$("#todo-list [data-item]").filter(
		(el) => el.getAttribute("data-done") !== "true",
	).length;
	const footer = $('footer [data-i18n="items_left"]');
	footer.setAttribute("data-i18n-qty", count);
	the.t();
};

on("#todo-form", "submit", "form", (e) => {
	e.preventDefault();
	const { task } = the.form(e.target);
	if (!task?.trim()) return;
	the($.clone("#todo-list", "#todo-item"), { task });
	$("#todo-input").value = "";
	updateCount();
});

on("#todo-list", "change", '[data-action="toggle-todo"]', (_e, target) => {
	the(target.closest("[data-item]"), "done", String(target.checked));
	updateCount();
});

on("#todo-list", "click", '[data-action="delete-todo"]', (_e, target) => {
	target.closest("[data-item]").remove();
	updateCount();
});

updateCount();
