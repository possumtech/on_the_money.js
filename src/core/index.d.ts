export type StateValue = string | number | boolean | null;
export type State = Record<string, StateValue>;
export type DictionaryEntry = string | Record<string, string>;
export type Dictionary = Record<string, DictionaryEntry>;

export interface TranslationOptions {
	[key: string]: unknown;
	type?: "currency" | "date" | string;
	currency?: string;
	qty?: number | string;
	val?: unknown;
}

export interface BootOptions {
	signal?: AbortSignal;
	locales?: string;
	dictionary?: Dictionary;
	namespace?: string;
	defaultLocale?: string;
	persistKeys?: string[];
}

export interface The {
	(key: string): string | null;
	(key: string, value: StateValue): HTMLElement;
	(values: State): HTMLElement;
	<T extends Element>(element: T, key: string): string | null;
	<T extends Element>(element: T, key: string, value: StateValue): T;
	<T extends Element>(element: T, values: State): T;
	t: typeof _t;
	route: Route;
	form(form: HTMLFormElement): Record<string, unknown>;
	flat(object: object, separator?: string): Record<string, unknown>;
	match(pattern: string, path?: string): Record<string, string> | null;
	boot(options?: BootOptions): Promise<void>;
	dictionary: Dictionary;
	locale: string;
}

export interface Route {
	(
		callback: (pathname: string, search: string, hash: string) => void,
		options?: { match?: string },
	): (() => void) | undefined;
	go(path: string): void;
}

export interface Select {
	<E extends Element = Element>(selector: string): E | null;
	<E extends Element = Element>(
		context: ParentNode,
		selector: string,
	): E | null;
	clone(
		parent: Element | string,
		selector: string,
		options?: { position?: InsertPosition },
	): HTMLElement;
	cloneEach<T>(
		parent: Element | string,
		selector: string,
		items: Iterable<T>,
		fill?: (element: HTMLElement, item: T, index: number) => void,
	): HTMLElement[];
}

export interface SelectAll {
	<E extends Element = Element>(selector: string): E[];
	<E extends Element = Element>(context: ParentNode, selector: string): E[];
}

export interface On {
	(
		parent: Element | Document | string | null,
		event: string,
		selector: string,
		handler: (this: Element, event: Event, target: Element) => void,
	): () => void;
	emit(element: Element | string, event: string, detail?: unknown): void;
}

export function _t(key: string, options?: TranslationOptions): string;
export function _t<T extends Node>(node: T): T;
export function _t(): string;

export const the: The;
export const route: Route;
export const $: Select;
export const $$: SelectAll;
export const on: On;

declare const api: {
	on: On;
	the: The;
	$: Select;
	$$: SelectAll;
	_t: typeof _t;
};

export default api;
