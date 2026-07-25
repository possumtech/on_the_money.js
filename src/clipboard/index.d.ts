export interface ClipboardOptions {
	resetMs?: number;
}

export function clipboard(options?: ClipboardOptions): (() => void) | null;

declare const api: { clipboard: typeof clipboard };
export default api;
