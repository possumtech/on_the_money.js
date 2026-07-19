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

test("sse: AbortSignal closes the source", (_t) => {
	setup();
	const ac = new AbortController();
	sse("/stream", { signal: ac.signal });
	ac.abort();
	assert.strictEqual(FakeEventSource.instances[0].closed, true);
});
