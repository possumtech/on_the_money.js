import { $, $$, _t, on, route, the } from "on_the_money";
import { clipboard } from "on_the_money/clipboard";
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
void the.boot({ persistKeys: ["theme"], dictionary: { title: "Title" } });
void _t("price", { type: "currency", currency: "EUR", val: 2 });

const off = on(document.body, "click", "[data-action]", (_event, target) => {
	void target;
});
off();
const stopRouter = route(() => {}, { match: "[data-route]" });
stopRouter?.();
route.go("/next");

const channel = live("/ws", {
	onError(error, raw) {
		void error.cause;
		void raw;
	},
});
channel.send({ type: "ping" });
void channel.request<{ type: string; data: string }>({ type: "query" });
void sse("/events", { types: ["token"] });
void clipboard({ resetMs: 1000 });
void setupDOM("<main></main>").document;
void [elements, eslintConfig, eslintPlugin, stylelintConfig, stylelintPlugin];
