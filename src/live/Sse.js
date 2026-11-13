import On from "../core/On.js";
import { backoffDelay } from "./Live.js";

const STABLE_MS = 10_000;

// Server-Sent Events battery — uses native EventSource when no custom headers
// are requested, and WHATWG fetch-streaming SSE when headers (static or async
// credential supplier) are provided. Shares live()'s handler contract.
// NOT in scope: request/reply correlation (SSE is one-way — use live()).
export default class Sse {
	#source = null;
	#stopped = false;
	#lastEventId = "";
	#retryMs = null;
	#attempt = 0;
	#stableTimer = null;
	#reconnectTimer = null;
	#attemptController = null;
	#offSignal = null;
	#offWakeups = [];

	constructor(
		path,
		{ types = [], headers, onMessage, onError, onDown, onUp, signal } = {},
	) {
		if (signal?.aborted) {
			this.#stopped = true;
			return;
		}
		if (signal) {
			this.#offSignal = On.target(signal, "abort", () => this.close(), {
				once: true,
			});
		}
		if (headers === undefined) {
			this.#source = new EventSource(path);
			this.#source.onopen = () => onUp?.();
			this.#source.onerror = (event) => {
				onError?.(event);
				onDown?.(event);
			};
			const dispatch = (e) =>
				onMessage?.(e.type, Sse.#decode(e.data), e.lastEventId);
			this.#source.onmessage = dispatch;
			for (const type of types) this.#source.addEventListener(type, dispatch);
			return;
		}

		const typeSet = new Set(types);
		const wake = () => {
			if (this.#stopped || this.#reconnectTimer === null) return;
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
			this.#dialFetch(path, {
				typeSet,
				headers,
				onMessage,
				onError,
				onDown,
				onUp,
			});
		};
		if (typeof window !== "undefined" && window?.addEventListener) {
			this.#offWakeups.push(On.target(window, "online", wake));
		}
		if (typeof document !== "undefined" && document?.addEventListener) {
			this.#offWakeups.push(
				On.target(document, "visibilitychange", () => {
					if (document.visibilityState === "visible") wake();
				}),
			);
		}
		this.#dialFetch(path, {
			typeSet,
			headers,
			onMessage,
			onError,
			onDown,
			onUp,
		});
	}

	close() {
		if (this.#stopped) return;
		this.#stopped = true;
		clearTimeout(this.#stableTimer);
		this.#stableTimer = null;
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = null;
		this.#offSignal?.();
		this.#offSignal = null;
		for (const off of this.#offWakeups) off();
		this.#offWakeups = [];
		this.#attemptController?.abort();
		this.#attemptController = null;
		this.#source?.close();
		this.#source = null;
	}

	#dialFetch(path, handlers) {
		if (this.#stopped) return;
		this.#attemptController?.abort();
		const attempt = new AbortController();
		this.#attemptController = attempt;
		void this.#runFetch(path, handlers, attempt.signal);
	}

	async #runFetch(
		path,
		{ typeSet, headers, onMessage, onError, onDown, onUp },
		attemptSignal,
	) {
		let reader = null;
		try {
			const supplied =
				typeof headers === "function" ? await headers(attemptSignal) : headers;
			if (this.#stopped || attemptSignal.aborted) return;
			const reqHeaders = new Headers(supplied ?? undefined);
			if (!reqHeaders.has("accept")) {
				reqHeaders.set("accept", "text/event-stream");
			}
			if (this.#lastEventId && !reqHeaders.has("last-event-id")) {
				reqHeaders.set("last-event-id", this.#lastEventId);
			}
			const response = await fetch(path, {
				headers: reqHeaders,
				cache: "no-store",
				signal: attemptSignal,
			});
			if (this.#stopped || attemptSignal.aborted) return;
			if (response.status === 204) {
				this.close();
				onDown?.();
				return;
			}
			if (response.status !== 200) {
				const retryable =
					response.status === 408 ||
					response.status === 429 ||
					response.status >= 500;
				const error = Object.assign(
					new Error(
						`otm sse: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
					),
					{ status: response.status, response },
				);
				if (!retryable) this.close();
				onError?.(error);
				onDown?.(error);
				if (retryable) {
					this.#scheduleReconnect(path, {
						typeSet,
						headers,
						onMessage,
						onError,
						onDown,
						onUp,
					});
				}
				return;
			}
			const contentType = response.headers
				.get("content-type")
				?.split(";")[0]
				.trim()
				.toLowerCase();
			if (contentType !== "text/event-stream" || !response.body) {
				const error = Object.assign(
					new Error(
						`otm sse: expected text/event-stream, got ${contentType || "none"}`,
					),
					{ status: response.status, response, protocolFailure: true },
				);
				this.close();
				onError?.(error);
				onDown?.(error);
				return;
			}

			this.#stableTimer = setTimeout(() => {
				this.#attempt = 0;
			}, STABLE_MS);
			onUp?.();

			reader = response.body.getReader();
			const decoder = new TextDecoder("utf-8");
			let buffer = "";
			let firstChunk = true;
			let eventType = "message";
			let dataLines = [];
			let hasData = false;

			const processLine = (line) => {
				if (line === "") {
					if (hasData) {
						const payload = dataLines.join("\n");
						const type = eventType || "message";
						dataLines = [];
						hasData = false;
						eventType = "message";
						if (type === "message" || typeSet.has(type)) {
							onMessage?.(type, Sse.#decode(payload), this.#lastEventId);
						}
					} else {
						eventType = "message";
					}
					return;
				}
				if (line.startsWith(":")) return;
				const colon = line.indexOf(":");
				let field = line;
				let value = "";
				if (colon !== -1) {
					field = line.slice(0, colon);
					value = line.slice(colon + 1);
					if (value.startsWith(" ")) value = value.slice(1);
				}
				if (field === "event") {
					eventType = value;
				} else if (field === "data") {
					dataLines.push(value);
					hasData = true;
				} else if (field === "id") {
					if (!value.includes("\0")) this.#lastEventId = value;
				} else if (field === "retry") {
					if (/^\d+$/.test(value)) this.#retryMs = Number(value);
				}
			};

			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				let chunk = decoder.decode(value, { stream: true });
				if (firstChunk) {
					firstChunk = false;
					if (chunk.startsWith("\uFEFF")) chunk = chunk.slice(1);
				}
				buffer += chunk;
				const parts = buffer.split(/\r\n|\r|\n/);
				buffer = parts.pop() ?? "";
				for (const line of parts) {
					processLine(line);
					if (this.#stopped || attemptSignal.aborted) return;
				}
			}
			buffer += decoder.decode();
			if (this.#stopped || attemptSignal.aborted) return;
			clearTimeout(this.#stableTimer);
			this.#stableTimer = null;
			onDown?.();
			this.#scheduleReconnect(path, {
				typeSet,
				headers,
				onMessage,
				onError,
				onDown,
				onUp,
			});
		} catch (error) {
			clearTimeout(this.#stableTimer);
			this.#stableTimer = null;
			if (this.#stopped || attemptSignal.aborted) return;
			onError?.(error);
			onDown?.(error);
			this.#scheduleReconnect(path, {
				typeSet,
				headers,
				onMessage,
				onError,
				onDown,
				onUp,
			});
		} finally {
			await reader?.cancel().catch(() => undefined);
		}
	}

	#scheduleReconnect(path, handlers) {
		if (this.#stopped) return;
		this.#attempt += 1;
		const delay =
			this.#retryMs !== null ? this.#retryMs : backoffDelay(this.#attempt);
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = null;
			this.#dialFetch(path, handlers);
		}, delay);
	}

	static #decode(data) {
		try {
			return JSON.parse(data);
		} catch {
			return data;
		}
	}
}
