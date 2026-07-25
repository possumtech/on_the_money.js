export interface DOMSetup {
	document: Document;
	window: Window;
	[key: string]: unknown;
}

export function setupDOM(
	html?: string,
	options?: { url?: string; language?: string },
): DOMSetup;
