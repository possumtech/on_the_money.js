import { parseHTML } from "linkedom";

// Consumer-facing test harness: a linkedom DOM with every global an OTM app
// touches, installed on globalThis. Returns the parseHTML result — destructure
// what you need: const { document, window } = setupDOM("<main></main>");
export const setupDOM = (
	html = "",
	{ url = "http://localhost/", language = "en-US" } = {},
) => {
	const dom = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);

	globalThis.document = dom.document;
	globalThis.Node = dom.Node;
	globalThis.Element = dom.Element;
	globalThis.CustomEvent = dom.CustomEvent;
	globalThis.HTMLElement = dom.HTMLElement;
	globalThis.HTMLFormElement = dom.HTMLFormElement;
	globalThis.FormData = dom.FormData;
	globalThis.window = dom.window;

	// Node's own navigator is a frozen getter; shadow it configurably.
	Object.defineProperty(globalThis, "navigator", {
		value: { language },
		configurable: true,
		writable: true,
	});

	const u = new URL(url);
	globalThis.window.location = {
		pathname: u.pathname,
		search: u.search,
		hash: u.hash,
		origin: u.origin,
		host: u.host,
		protocol: u.protocol,
		href: u.href,
	};

	globalThis.window.history = {
		pushState: (_state, _title, next) => {
			const target = new URL(next, globalThis.window.location.href);
			globalThis.window.location.href = target.href;
			globalThis.window.location.pathname = target.pathname;
			globalThis.window.location.search = target.search;
			globalThis.window.location.hash = target.hash;
		},
	};

	const storage = {};
	globalThis.localStorage = {
		getItem: (k) => storage[k] ?? null,
		setItem: (k, v) => {
			storage[k] = String(v);
		},
		removeItem: (k) => {
			delete storage[k];
		},
		key: (i) => Object.keys(storage)[i],
		get length() {
			return Object.keys(storage).length;
		},
		clear: () => {
			for (const k of Object.keys(storage)) delete storage[k];
		},
	};

	return dom;
};
