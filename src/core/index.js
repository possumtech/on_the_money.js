import On from "./On.js";
import Select from "./Select.js";
import The from "./The.js";

// Named Exports (First-Class Citizens)
export const on = On.on;
on.emit = On.emit;

export const the = The.the;
export const _t = The._t;
export const route = The.route;
the.t = _t;
the.route = route;
the.form = (el) => The.the(el);

export const $ = Select.$;
$.clone = Select.clone;

export const $$ = Select.$$;

// Default Export (Everything included)
export default { on, the, $, $$, _t };

// The Handshake (Auto-rehydrate on import)
if (typeof document !== "undefined") {
	the.ready = The.handshake();
}
