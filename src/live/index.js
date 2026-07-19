import The from "../core/The.js";
import Live from "./Live.js";
import Sse from "./Sse.js";

export { backoffDelay } from "./Live.js";

// sse("/stream", { types, onMessage, onDown, onUp, signal }) — the
// EventSource handoff; same handler contract as live().
export const sse = (path, options) => new Sse(path, options);

// live("/ws", opts) — path (or full ws:// / wss:// URL) channel.
// live({ fromState: "live-channel" }, opts) — reads the server-advertised
// channel from body state; returns null when the page has no live
// representation (the conditional-mount pattern).
export const live = (channel, options) => {
	if (typeof channel === "string") return new Live(channel, options);
	const path = The.the(channel.fromState);
	return path ? new Live(path, options) : null;
};

export default { live, sse };
