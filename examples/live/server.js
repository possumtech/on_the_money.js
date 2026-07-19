// Reference server for the on_the_money/live wire conventions
// (see asyncapi.yaml beside this file). Not shipped in the package and
// not executed by CI — this is the canonical text to generate a real
// server against: hello on connect, { type, at, data } envelopes,
// req_id echoed verbatim on correlated replies, close(1000) only when
// the client should not return.
import { WebSocketServer } from "ws";

export default function mountLive({ server, path = "/ws" }) {
	const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

	wss.on("connection", (socket) => {
		send(socket, "hello", null);
		socket.on("message", async (raw) => {
			let frame;
			try {
				frame = JSON.parse(raw);
			} catch {
				return;
			}
			// Request/reply: echo req_id on the correlated answer.
			if (frame.req_id != null) {
				return reply(socket, frame.req_id, "results", await handle(frame));
			}
			// Fire-and-forget frames need no reply.
			await handle(frame);
		});
	});

	server.on("upgrade", (req, socket, head) => {
		const { pathname } = new URL(req.url ?? "/", "http://internal");
		if (pathname !== path) return socket.destroy();
		wss.handleUpgrade(req, socket, head, (ws) =>
			wss.emit("connection", ws, req),
		);
	});
	return wss;
}

const send = (socket, type, data) => {
	try {
		socket.send(JSON.stringify({ type, at: new Date().toISOString(), data }));
	} catch {
		/* a dying socket is not our problem */
	}
};

const reply = (socket, reqId, type, data) => {
	try {
		socket.send(
			JSON.stringify({
				req_id: reqId,
				type,
				at: new Date().toISOString(),
				data,
			}),
		);
	} catch {
		/* a dying socket is not our problem */
	}
};

// Replace with your application's dispatch.
const handle = async (frame) => ({ echoed: frame.type ?? null });
