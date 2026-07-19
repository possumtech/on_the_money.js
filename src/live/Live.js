// Browser WebSocket lifecycle battery — harvested from four production
// consumer implementations of the same skeleton. Owns: URL derivation,
// handler properties, JSON codec, jittered backoff with stable reset and
// guarded dial, close-1000-terminal, req_id correlation with
// flush-on-close. NOT in scope: auth handshakes, heartbeats, binary
// frames, offline queueing, presence.
const CEILING_MS = 30_000;
const STABLE_MS = 10_000;

// Equal jitter: [base/2, base). Pure and rand-injectable so the curve is
// unit-testable; de-synchronizes reconnect herds.
export const backoffDelay = (attempt, rand = Math.random) => {
	const base = Math.min(CEILING_MS, 1000 * 2 ** attempt);
	return base / 2 + rand() * (base / 2);
};

export default class Live {
	#path;
	#options;
	#socket = null;
	#attempt = 0;
	#stableTimer = null;
	#reconnectTimer = null;
	#stopped = false;
	#seq = 0;
	#latest = 0;
	#pending = new Map(); // req_id → { resolve, timer, takeLatest }
	#held = null; // newest takeLatest request awaiting an open socket

	constructor(path, options = {}) {
		this.#path = path;
		this.#options = options;
		// Handler property, not addEventListener: single handler on a
		// non-DOM target — the sanctioned shape (§The Discipline).
		if (options.signal) options.signal.onabort = () => this.#stop();
		this.#dial();
	}

	// Fire-and-forget; silently dropped while the link is down (best-effort
	// posture — a missed frame changes nothing a refresh won't show).
	send(frame) {
		if (this.#open()) this.#socket.send(JSON.stringify(frame));
	}

	// Resolves the correlated reply, or null on down/timeout/supersession —
	// never rejects. Degraded-display posture: "unavailable" is the correct
	// answer when the link can't deliver.
	request(frame, { timeoutMs = 5000, takeLatest = false } = {}) {
		if (this.#stopped) return Promise.resolve(null);
		const id = ++this.#seq;
		if (takeLatest) this.#latest = id;
		if (!this.#open()) {
			if (!takeLatest) return Promise.resolve(null);
			// Hold only the newest frame for the next open; the superseded
			// holder learns it lost now, not at some timeout.
			return new Promise((resolve) => {
				this.#held?.resolve(null);
				this.#held = { id, frame, resolve, timeoutMs };
			});
		}
		return this.#dispatch(id, frame, timeoutMs, takeLatest);
	}

	#open() {
		return this.#socket?.readyState === 1; // WebSocket.OPEN
	}

	#dispatch(id, frame, timeoutMs, takeLatest) {
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.#pending.delete(id);
				resolve(null);
			}, timeoutMs);
			this.#pending.set(id, { resolve, timer, takeLatest });
			this.#socket.send(JSON.stringify({ ...frame, req_id: id }));
		});
	}

	// Guarded (re)dial: a synchronous constructor throw must reschedule the
	// loop, not orphan it.
	#dial() {
		if (this.#stopped) return;
		try {
			this.#connect();
		} catch (e) {
			console.warn("otm live: dial failed, rescheduling", e);
			this.#scheduleReconnect();
		}
	}

	#connect() {
		const socket = new WebSocket(this.#url());
		this.#socket = socket;
		socket.onopen = () => {
			// Backoff resets only after the link proves stable — a socket
			// that opens then is immediately shed must not zero the counter,
			// or we tight-loop.
			this.#stableTimer = setTimeout(() => {
				this.#attempt = 0;
			}, STABLE_MS);
			this.#options.onUp?.();
			if (this.#held) this.#flushHeld();
		};
		socket.onmessage = (e) => this.#receive(e.data);
		socket.onclose = (e) => {
			clearTimeout(this.#stableTimer);
			this.#flushPending();
			this.#options.onDown?.();
			// 1000 is the server's deliberate close — reconnecting would be
			// a polite self-DoS. Everything else retries with capped backoff.
			if (this.#stopped || e.code === 1000) return;
			this.#scheduleReconnect();
		};
	}

	#url() {
		if (/^wss?:\/\//.test(this.#path)) return this.#path;
		const scheme = window.location.protocol === "https:" ? "wss" : "ws";
		return `${scheme}://${window.location.host}${this.#path}`;
	}

	#scheduleReconnect() {
		this.#attempt += 1;
		this.#reconnectTimer = setTimeout(
			() => this.#dial(),
			backoffDelay(this.#attempt),
		);
	}

	#receive(raw) {
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		const pending = msg?.req_id != null ? this.#pending.get(msg.req_id) : null;
		if (pending) {
			this.#pending.delete(msg.req_id);
			clearTimeout(pending.timer);
			// latest-wins: a superseded reply is not an answer.
			pending.resolve(
				pending.takeLatest && msg.req_id < this.#latest ? null : msg,
			);
			return;
		}
		this.#options.onMessage?.(msg.type, msg.data, msg.at);
	}

	#flushHeld() {
		const { id, frame, resolve, timeoutMs } = this.#held;
		this.#held = null;
		if (id < this.#latest) return resolve(null);
		this.#dispatch(id, frame, timeoutMs, true).then(resolve);
	}

	// A dropped socket can never answer — resolve in-flight requests now
	// rather than letting each dangle to its timeout.
	#flushPending() {
		for (const { resolve, timer } of this.#pending.values()) {
			clearTimeout(timer);
			resolve(null);
		}
		this.#pending.clear();
	}

	#stop() {
		this.#stopped = true;
		clearTimeout(this.#reconnectTimer);
		clearTimeout(this.#stableTimer);
		this.#flushPending();
		this.#held?.resolve(null);
		this.#held = null;
		this.#socket?.close();
	}
}
