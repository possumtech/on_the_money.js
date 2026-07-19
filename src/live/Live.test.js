import assert from "node:assert";
import test from "node:test";
import { setupDOM } from "../test/index.js";
import Live, { backoffDelay } from "./Live.js";
import { live } from "./index.js";

class FakeSocket {
	static instances = [];
	readyState = 0;
	sent = [];
	constructor(url) {
		this.url = url;
		FakeSocket.instances.push(this);
	}
	send(s) {
		this.sent.push(s);
	}
	close(code = 1005) {
		this.readyState = 3;
		this.onclose?.({ code });
	}
	open() {
		this.readyState = 1;
		this.onopen?.();
	}
	message(obj) {
		this.onmessage?.({ data: JSON.stringify(obj) });
	}
}

const setup = (html = "") => {
	const dom = setupDOM(html);
	FakeSocket.instances = [];
	globalThis.WebSocket = FakeSocket;
	return dom;
};

test("backoffDelay: equal jitter within [base/2, base), capped at ceiling", (_t) => {
	assert.strictEqual(
		backoffDelay(1, () => 0),
		1000,
	);
	assert.ok(backoffDelay(1, () => 0.999) < 2000);
	assert.strictEqual(
		backoffDelay(20, () => 0),
		15_000,
	);
	assert.ok(backoffDelay(20, () => 0.999) < 30_000);
});

test("live: derives ws URL from location; absolute URLs pass through", (_t) => {
	setup();
	new Live("/ws", {});
	assert.strictEqual(FakeSocket.instances[0].url, "ws://localhost/ws");
	new Live("wss://example.test/feed", {});
	assert.strictEqual(FakeSocket.instances[1].url, "wss://example.test/feed");
});

test("live: dispatches {type, data, at} to onMessage", (_t) => {
	setup();
	const seen = [];
	new Live("/ws", {
		onMessage: (type, data, at) => seen.push([type, data, at]),
	});
	const sock = FakeSocket.instances[0];
	sock.open();
	sock.message({ type: "status", at: "now", data: { ok: true } });
	assert.deepStrictEqual(seen, [["status", { ok: true }, "now"]]);
});

test("live: request correlates on req_id and resolves the reply", async (_t) => {
	setup();
	const ch = new Live("/ws", {});
	const sock = FakeSocket.instances[0];
	sock.open();
	const p = ch.request({ type: "query", q: "x" });
	const sent = JSON.parse(sock.sent[0]);
	assert.strictEqual(sent.req_id, 1);
	assert.strictEqual(sent.q, "x");
	sock.message({ req_id: 1, type: "results", data: [1, 2] });
	assert.deepStrictEqual((await p).data, [1, 2]);
});

test("live: request resolves null on timeout", async (t) => {
	setup();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const ch = new Live("/ws", {});
	const sock = FakeSocket.instances[0];
	sock.open();
	const p = ch.request({ type: "query" }, { timeoutMs: 50 });
	t.mock.timers.tick(60);
	assert.strictEqual(await p, null);
});

test("live: close flushes pending null, fires onDown, deliberate 1000 is terminal", async (t) => {
	setup();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let downs = 0;
	const ch = new Live("/ws", { onDown: () => downs++ });
	const sock = FakeSocket.instances[0];
	sock.open();
	const p = ch.request({ type: "query" });
	sock.close(1000);
	assert.strictEqual(await p, null);
	assert.strictEqual(downs, 1);
	t.mock.timers.tick(60_000);
	assert.strictEqual(FakeSocket.instances.length, 1);
});

test("live: abnormal close reconnects with backoff; request while down resolves null", async (t) => {
	setup();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const ch = new Live("/ws", {});
	FakeSocket.instances[0].open();
	FakeSocket.instances[0].close(1006);
	assert.strictEqual(await ch.request({ type: "query" }), null);
	t.mock.timers.tick(31_000);
	assert.strictEqual(FakeSocket.instances.length, 2);
});

test("live: takeLatest supersedes in-flight requests", async (_t) => {
	setup();
	const ch = new Live("/ws", {});
	const sock = FakeSocket.instances[0];
	sock.open();
	const p1 = ch.request({ type: "filter", page: 1 }, { takeLatest: true });
	const p2 = ch.request({ type: "filter", page: 2 }, { takeLatest: true });
	sock.message({ req_id: 1, type: "results", data: "stale" });
	sock.message({ req_id: 2, type: "results", data: "fresh" });
	assert.strictEqual(await p1, null);
	assert.strictEqual((await p2).data, "fresh");
});

test("live: takeLatest holds only the newest frame while down, flushes on open", async (_t) => {
	setup();
	const ch = new Live("/ws", {});
	const sock = FakeSocket.instances[0];
	const p1 = ch.request({ type: "filter", page: 1 }, { takeLatest: true });
	const p2 = ch.request({ type: "filter", page: 2 }, { takeLatest: true });
	assert.strictEqual(await p1, null);
	sock.open();
	const sent = JSON.parse(sock.sent[0]);
	assert.strictEqual(sent.req_id, 2);
	sock.message({ req_id: 2, type: "results", data: "fresh" });
	assert.strictEqual((await p2).data, "fresh");
});

test("live: AbortSignal stops the channel — closed, no reconnect", (t) => {
	setup();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const ac = new AbortController();
	new Live("/ws", { signal: ac.signal });
	const sock = FakeSocket.instances[0];
	sock.open();
	ac.abort();
	assert.strictEqual(sock.readyState, 3);
	t.mock.timers.tick(60_000);
	assert.strictEqual(FakeSocket.instances.length, 1);
});

test("live({ fromState }): reads the advertised channel; null when absent", (_t) => {
	const { document } = setup();
	assert.strictEqual(live({ fromState: "live-channel" }, {}), null);
	document.body.setAttribute("data-live-channel", "/story.ws");
	const ch = live({ fromState: "live-channel" }, {});
	assert.ok(ch instanceof Live);
	assert.strictEqual(FakeSocket.instances[0].url, "ws://localhost/story.ws");
});

test("live: send is fire-and-forget, dropped while down", (_t) => {
	setup();
	const ch = new Live("/ws", {});
	const sock = FakeSocket.instances[0];
	ch.send({ type: "ping" });
	assert.strictEqual(sock.sent.length, 0);
	sock.open();
	ch.send({ type: "ping" });
	assert.strictEqual(JSON.parse(sock.sent[0]).type, "ping");
});
