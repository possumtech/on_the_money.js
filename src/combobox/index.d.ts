export interface ComboboxOptions {
	/** Called after an option is committed (Enter, click, or select()). */
	onSelect?: (option: HTMLElement, input: HTMLElement) => void;
	/** Called after the listbox transitions from closed to open. */
	onOpen?: (input: HTMLElement, listbox: HTMLElement) => void;
	/** Called after the listbox transitions from open to closed. */
	onClose?: (input: HTMLElement, listbox: HTMLElement) => void;
	/** Wrap ArrowDown/ArrowUp at list boundaries (default: true). */
	wrap?: boolean;
	/** Open the listbox on focus/click of an editable combobox (default: true). */
	openOnFocus?: boolean;
	/** Clear an editable input on Escape when the listbox is already closed (default: true). */
	clearOnEscape?: boolean;
	/** Close the listbox automatically when an option is selected (default: true). */
	closeOnSelect?: boolean;
	/** Teardown signal that detaches all listeners and clears transient active state. */
	signal?: AbortSignal;
}

export interface ComboboxController {
	readonly input: HTMLElement;
	readonly listbox: HTMLElement;
	readonly expanded: boolean;
	readonly activeOption: HTMLElement | null;
	open(): void;
	close(): void;
	/** Reconcile option IDs and clear stale aria-activedescendant after external DOM updates. */
	sync(): void;
	/** Commit a specific [role="option"] element inside the controlled listbox. */
	select(option: HTMLElement): void;
	/** Detach all listeners and clear transient active-descendant state. */
	dispose(): void;
}

export function combobox(
	target: HTMLElement | string,
	options?: ComboboxOptions,
): ComboboxController;

declare const api: { combobox: typeof combobox };
export default api;
