import On from "./On.js";
import Select from "./Select.js";
import The from "./The.js";

export const on = On.on;
on.emit = On.emit;

export const the = The.the;
export const _t = The._t;
export const route = The.route;
route.go = The.go;
the.t = _t;
the.route = route;
the.form = The.form;
the.flat = The.flat;
the.match = The.match;
the.boot = The.boot;

Object.defineProperty(the, "dictionary", {
	get: () => The.dictionary,
	set: (v) => {
		The.dictionary = v;
	},
});

Object.defineProperty(the, "locale", {
	get: () => The.locale,
	set: (v) => {
		The.locale = v;
	},
});

export const $ = Select.$;
$.clone = Select.clone;

export const $$ = Select.$$;

export default { on, the, $, $$, _t };
