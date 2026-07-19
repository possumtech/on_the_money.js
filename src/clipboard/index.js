import { on, the } from "../core/index.js";

// Copy-to-clipboard affordances — the capability-declaration pattern:
// writing to the clipboard is behavior CSS cannot express, and the API
// exists only in secure contexts. Render copy buttons hidden; clipboard()
// declares body[data-clipboard="available"] only when the platform can
// deliver, and state-CSS reveals them. With JS off, or without the API,
// the buttons never appear: no dead controls. Returns the on()
// unsubscribe, or null when the capability is absent (conditional mount).
export const clipboard = ({ resetMs = 2000 } = {}) => {
	if (!navigator.clipboard) return null;
	the("clipboard", "available");
	return on(document.body, "click", "[data-copy]", async (_e, button) => {
		await navigator.clipboard.writeText(button.getAttribute("data-copy"));
		the(button, "copied", true);
		setTimeout(() => the(button, "copied", false), resetMs);
	});
};

export default { clipboard };
