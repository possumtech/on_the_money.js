import assert from "node:assert";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import { sse } from "./index.js";

class FakeEventSource {
	static instances = [];
	closed = false;
	listeners = new Map();
	constructor(url) {
		this.url = url;
		FakeEventSource.instances.push(this);
	}
	addEventListener(type, fn) {
		this.listeners.set(type, fn);
	}
	close() {
		this.closed = true;
	}
	emit(type, data, lastEventId = "") {
		const e = { type, data, lastEventId };
		if (type === "message") return this.onmessage?.(e);
		this.listeners.get(type)?.(e);
	}
}

const setup = () => {
	const dom = setupDOM();
	FakeEventSource.instances = [];
	globalThis.EventSource = FakeEventSource;
	return dom;
};

test("sse: unnamed frames dispatch as 'message' with JSON decode", (_t) => {
	setup();
	const seen = [];
	sse("/stream", {
		onMessage: (type, data, id) => seen.push([type, data, id]),
	});
	FakeEventSource.instances[0].emit("message", '{"ok":true}', "42");
	assert.deepStrictEqual(seen, [["message", { ok: true }, "42"]]);
});

test("sse: named types subscribe and dispatch with their type", (_t) => {
	setup();
	const seen = [];
	sse("/stream", {
		types: ["status", "delta"],
		onMessage: (type, data) => seen.push([type, data]),
	});
	const src = FakeEventSource.instances[0];
	src.emit("status", '{"up":1}');
	src.emit("delta", '{"n":2}');
	assert.deepStrictEqual(seen, [
		["status", { up: 1 }],
		["delta", { n: 2 }],
	]);
});

test("sse: non-JSON payloads pass through as raw text", (_t) => {
	setup();
	const seen = [];
	sse("/stream", {
		types: ["token"],
		onMessage: (_t2, data) => seen.push(data),
	});
	FakeEventSource.instances[0].emit("token", "Hello, ");
	FakeEventSource.instances[0].emit("token", "world");
	assert.deepStrictEqual(seen, ["Hello, ", "world"]);
});

test("sse: onUp/onDown ride onopen/onerror", (_t) => {
	setup();
	const calls = [];
	sse("/stream", {
		onUp: () => calls.push("up"),
		onDown: () => calls.push("down"),
	});
	const src = FakeEventSource.instances[0];
	src.onopen();
	src.onerror();
	assert.deepStrictEqual(calls, ["up", "down"]);
});

test("sse: AbortSignal closes all subscribed sources and skips pre-aborted signals", (_t) => {
	setup();
	const ac = new AbortController();
	sse("/stream-a", { signal: ac.signal });
	sse("/stream-b", { signal: ac.signal });
	ac.abort();
	assert.strictEqual(FakeEventSource.instances[0].closed, true);
	assert.strictEqual(FakeEventSource.instances[1].closed, true);

	sse("/stream-preaborted", { signal: ac.signal });
	assert.strictEqual(FakeEventSource.instances.length, 2);
});

const streamFromChunks = (chunks) => {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
};

test("sse({ headers }): streams WHATWG frames, forwards Last-Event-ID, honors retry:, and wakes on online", async (t) => {
	const { window } = setup();
	const requests = [];
	let tokenCalls = 0;
	let attempt = 0;
	globalThis.fetch = async (url, init) => {
		requests.push({
			url,
			authorization: init.headers.get("authorization"),
			accept: init.headers.get("accept"),
			lastEventId: init.headers.get("last-event-id"),
		});
		attempt += 1;
		if (attempt === 1) {
			return new Response(
				streamFromChunks([
					"\uFEFF: heartbeat\r\n",
					"retry: 5000\nid: evt-1\nevent: status\ndata: ",
					'{"ready":true}\n\n',
					"id: bad\0id\ndata: line 1\rdata: line 2\r\n\r\n",
					"event: ignored\ndata: skip\n\n",
				]),
				{
					status: 200,
					headers: { "content-type": "text/event-stream; charset=utf-8" },
				},
			);
		}
		return new Response(null, { status: 204 });
	};

	const seen = [];
	const lifecycle = [];
	const channel = sse("/notifications", {
		types: ["status"],
		headers: async () => ({
			authorization: `Bearer tok-${++tokenCalls}`,
		}),
		onUp: () => lifecycle.push("up"),
		onDown: () => lifecycle.push("down"),
		onMessage: (type, data, id) => seen.push([type, data, id]),
	});
	t.after(() => channel.close());

	await new Promise((r) => setTimeout(r, 30));
	assert.strictEqual(requests.length, 1);
	assert.strictEqual(requests[0].authorization, "Bearer tok-1");
	assert.strictEqual(requests[0].accept, "text/event-stream");
	assert.strictEqual(requests[0].lastEventId, null);
	assert.deepStrictEqual(seen, [
		["status", { ready: true }, "evt-1"],
		["message", "line 1\nline 2", "evt-1"],
	]);
	assert.deepStrictEqual(lifecycle, ["up", "down"]);

	// Wake immediately from the 5000ms retry timer via window 'online'
	window.dispatchEvent(new CustomEvent("online"));
	await new Promise((r) => setTimeout(r, 30));
	assert.strictEqual(requests.length, 2);
	assert.strictEqual(requests[1].authorization, "Bearer tok-2");
	assert.strictEqual(requests[1].lastEventId, "evt-1");
	// 204 is terminal — another online event does not redial
	window.dispatchEvent(new CustomEvent("online"));
	await new Promise((r) => setTimeout(r, 20));
	assert.strictEqual(requests.length, 2);
});

test("sse({ headers }): treats 401 and wrong Content-Type as terminal; retries 503", async (t) => {
	setup();
	let calls401 = 0;
	globalThis.fetch = async () => {
		calls401 += 1;
		return new Response("Unauthorized", { status: 401 });
	};
	const errors = [];
	sse("/auth-stream", {
		headers: { authorization: "Bearer expired" },
		onError: (err) => errors.push(err),
	});
	await new Promise((r) => setTimeout(r, 30));
	assert.strictEqual(calls401, 1);
	assert.strictEqual(errors[0]?.status, 401);

	let callsWrongType = 0;
	globalThis.fetch = async () => {
		callsWrongType += 1;
		return new Response("{}", {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	};
	const protoErrors = [];
	sse("/json-not-sse", {
		headers: { authorization: "Bearer ok" },
		onError: (err) => protoErrors.push(err),
	});
	await new Promise((r) => setTimeout(r, 30));
	assert.strictEqual(callsWrongType, 1);
	assert.strictEqual(protoErrors[0]?.protocolFailure, true);

	let calls503 = 0;
	const { document: dom } = setup();
	Object.defineProperty(dom, "visibilityState", {
		value: "visible",
		configurable: true,
	});
	globalThis.fetch = async () => {
		calls503 += 1;
		if (calls503 === 1) return new Response("Unavailable", { status: 503 });
		return new Response(streamFromChunks(['data: {"recovered":true}\n\n']), {
			status: 200,
			headers: { "content-type": "text/event-stream" },
		});
	};
	const recovered = [];
	const retryChannel = sse("/flaky", {
		headers: { authorization: "Bearer ok" },
		onMessage: (_type, data) => recovered.push(data),
	});
	t.after(() => retryChannel.close());
	await new Promise((r) => setTimeout(r, 30));
	assert.strictEqual(calls503, 1);
	dom.dispatchEvent(new CustomEvent("visibilitychange"));
	await new Promise((r) => setTimeout(r, 30));
	assert.strictEqual(calls503, 2);
	assert.deepStrictEqual(recovered, [{ recovered: true }]);
});
