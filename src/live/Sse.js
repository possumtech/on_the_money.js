// EventSource battery — the platform already owns reconnection, retry
// hints, and Last-Event-ID resume; this adapter owns only the OTM
// handoff: named-event subscription, JSON-or-text decode, one handler
// contract shared with live(). NOT in scope: correlation (SSE is one-way
// — use live() for request/reply), custom backoff (the platform's retry:
// hint governs), Authorization headers (cookie auth only; header auth
// needs fetch-streaming, deferred until a consumer needs it).
export default class Sse {
	#source;

	constructor(path, { types = [], onMessage, onDown, onUp, signal } = {}) {
		this.#source = new EventSource(path);
		this.#source.onopen = () => onUp?.();
		this.#source.onerror = () => onDown?.();
		const dispatch = (e) =>
			onMessage?.(e.type, Sse.#decode(e.data), e.lastEventId);
		this.#source.onmessage = dispatch;
		// Named SSE events (event: foo) need a listener per type — the
		// platform offers no wildcard. The adapter owns the EventSource;
		// consumers never touch it.
		for (const type of types) this.#source.addEventListener(type, dispatch);
		if (signal) signal.onabort = () => this.#source.close();
	}

	// SSE data is text: LLM token streams send raw chunks, most everything
	// else sends JSON. Decode when it parses, pass through when it doesn't —
	// the battery has no opinion about how data arrives.
	static #decode(data) {
		try {
			return JSON.parse(data);
		} catch {
			return data;
		}
	}
}
