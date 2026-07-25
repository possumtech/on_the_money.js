export interface LiveFrame {
	[key: string]: unknown;
	type?: string;
	data?: unknown;
	at?: unknown;
	req_id?: number;
}

export interface LiveOptions {
	onMessage?: (type: string | undefined, data: unknown, at: unknown) => void;
	onError?: (error: SyntaxError, raw: string) => void;
	onDown?: () => void;
	onUp?: () => void;
	signal?: AbortSignal;
}

export interface LiveChannel {
	send(frame: LiveFrame): void;
	request<T extends LiveFrame = LiveFrame>(
		frame: LiveFrame,
		options?: { timeoutMs?: number; takeLatest?: boolean },
	): Promise<T | null>;
}

export interface SseOptions {
	types?: string[];
	onMessage?: (type: string, data: unknown, lastEventId: string) => void;
	onDown?: () => void;
	onUp?: () => void;
	signal?: AbortSignal;
}

export function backoffDelay(attempt: number, random?: () => number): number;
export function live(channel: string, options?: LiveOptions): LiveChannel;
export function live(
	channel: { fromState: string },
	options?: LiveOptions,
): LiveChannel | null;
export function sse(path: string, options?: SseOptions): object;

declare const api: {
	live: typeof live;
	sse: typeof sse;
};

export default api;
