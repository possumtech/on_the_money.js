import { _t, $, $$, on, route, the } from "on_the_money";
import { clipboard } from "on_the_money/clipboard";
import { combobox } from "on_the_money/combobox";
import eslintConfig from "on_the_money/eslint-config";
import eslintPlugin from "on_the_money/eslint-plugin";
import { live, sse } from "on_the_money/live";
import stylelintConfig from "on_the_money/stylelint-config";
import stylelintPlugin from "on_the_money/stylelint-plugin";
import { setupDOM } from "on_the_money/test";

const element = $<HTMLElement>("#item");
const elements = $$<HTMLButtonElement>("[data-action]");
if (element) {
	the(element, "expanded", true);
	the(element, { count: 2, label: "two", absent: null });
}
the("theme", "dark");
the({ theme: "light", count: 2 });
void the("theme");
void the.flat({ user: { name: "Ada" } });
void the.form(document.querySelector("form") as HTMLFormElement);
void the.match("/posts/:id");
void the.boot({
	locale: "en-US",
	persistKeys: ["theme"],
	dictionary: { title: "Title" },
});
void _t("price", { type: "currency", currency: "EUR", val: 2 });
the.dictionary = { count: { one: "One", other: "{qty} items" } };
// @ts-expect-error plural entries require the standard other fallback
the.dictionary = { count: { one: "One" } };
// @ts-expect-error plural keys are Intl categories, not arbitrary strings
the.dictionary = { count: { invalid: "Invalid", other: "Many" } };

const off = on(document.body, "click", "[data-action]", (_event, target) => {
	void target;
});
off();
const offWindow = on.target(window, "resize", (_event) => {}, {
	signal: new AbortController().signal,
});
offWindow();
// @ts-expect-error DOM elements use delegated on(), not on.target()
on.target(document.body, "click", () => {});
// @ts-expect-error selector is mandatory, including for form submissions
on(document.body, "submit", () => {});
const stopRouter = route(() => {}, { match: "[data-route]", initial: false });
stopRouter?.();
route.go("/next");
route.go("/replaced", { replace: true });

const channel = live("/ws", {
	onError(error, raw) {
		void error.cause;
		void raw;
	},
});
channel.send({ type: "ping" });
void channel.request<{ type: string; data: string }>({ type: "query" });
const sseChannel = sse("/events", {
	types: ["token"],
	headers: async (_signal) => ({ authorization: "Bearer token" }),
	onError(error) {
		void error;
	},
});
sseChannel.close();
void clipboard({ resetMs: 1000 });
const combo = combobox("#model-input", {
	onSelect(option, input) {
		void option.dataset.value;
		void input.getAttribute("aria-expanded");
	},
	wrap: true,
	openOnFocus: true,
	clearOnEscape: true,
	closeOnSelect: true,
	signal: new AbortController().signal,
});
combo.open();
combo.sync();
if (combo.activeOption) combo.select(combo.activeOption);
combo.close();
combo.dispose();
void $.reconcile("#list", "#row", [{ id: "1", title: "One" }], {
	key: (item) => item.id,
	fill: (el, item, idx) => {
		the(el, { title: item.title, "row-index": idx });
	},
	attr: "data-item-id",
});
// @ts-expect-error attr must be a data-* attribute name
void $.reconcile("#list", "#row", ["a"], { key: (x) => x, attr: "id" });
void setupDOM("<main></main>").document;
void [elements, eslintConfig, eslintPlugin, stylelintConfig, stylelintPlugin];
