let activeNavigate = null;

export function match(pattern, path) {
	const subject =
		path ??
		(typeof window !== "undefined" && window.location
			? window.location.pathname
			: "");
	const paramNames = [];
	const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regexSource = escaped.replace(
		/:([a-zA-Z_][a-zA-Z0-9_]*)/g,
		(_, name) => {
			paramNames.push(name);
			return "([^/]+)";
		},
	);
	const m = subject.match(new RegExp(`^${regexSource}$`));
	if (!m) return null;
	const out = {};
	paramNames.forEach((name, i) => {
		out[name] = decodeURIComponent(m[i + 1]);
	});
	return out;
}

export function route(callback, { match: matchSelector, initial = true } = {}) {
	if (typeof window === "undefined") return;
	if (activeNavigate) {
		throw new Error(
			"route(): a router is already active — call its unsubscribe first",
		);
	}

	let lastHref = window.location.href;
	const navigate = () => {
		lastHref = window.location.href;
		callback(
			window.location.pathname,
			window.location.search,
			window.location.hash,
		);
	};
	const onHashChange = () => {
		if (window.location.href !== lastHref) navigate();
	};
	activeNavigate = navigate;

	const onClick = (e) => {
		// Modified clicks (new tab, context menu chords) belong to the browser.
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0)
			return;
		const link = e.target.closest("a");
		if (
			!link?.getAttribute("href") ||
			link.hasAttribute("data-external") ||
			link.hasAttribute("download") ||
			link.target === "_blank"
		) {
			return;
		}
		// Selective enhancement: with a match selector, only opted-in links
		// are intercepted — everything else navigates natively.
		if (matchSelector && !link.matches(matchSelector)) return;

		const url = new URL(link.getAttribute("href"), window.location.href);
		if (url.origin !== window.location.origin) return;

		if (
			url.pathname === window.location.pathname &&
			url.search === window.location.search &&
			url.hash
		) {
			return;
		}

		e.preventDefault();
		if (url.href === window.location.href) return;
		window.history.pushState({}, "", url.href);
		navigate();
	};

	window.addEventListener("popstate", navigate);
	window.addEventListener("hashchange", onHashChange);
	document.addEventListener("click", onClick);

	if (initial) navigate();

	return () => {
		window.removeEventListener("popstate", navigate);
		window.removeEventListener("hashchange", onHashChange);
		document.removeEventListener("click", onClick);
		activeNavigate = null;
	};
}

// Programmatic navigation. pushState/replaceState don't fire popstate, so
// the click interceptor can't cover redirects (e.g. post-submit).
export function go(path, { replace = false } = {}) {
	if (typeof window === "undefined") return;
	if (!activeNavigate) {
		throw new Error("route.go(): no active router — call route() first");
	}
	const url = new URL(path, window.location.href);
	if (url.href === window.location.href) return;
	if (replace) {
		window.history.replaceState({}, "", url.href);
	} else {
		window.history.pushState({}, "", url.href);
	}
	activeNavigate();
}
