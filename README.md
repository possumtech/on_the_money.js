# on_the_money.js 💸

An opinionated web project **Anti-Framework** that enforces a deterministic, DOM-first approach using native browser APIs and strict architectural constraints.

## Core Features

- **DOM as Database**: Application state is reflected in attributes on DOM elements.
- **Interactive Integrity**: Linter enforces A11y standards (labels, roles, interactive semantics).
- **Advanced Localization**: Built-in `Intl` integration for plurals, currency, and date formatting.
- **Pure Templating**: `$.clone('#template')` returns standard DOM elements.
- **State Persistence**: `the()` manages state and automatically syncs with `localStorage`.
- **CSS as UI Engine**: Visual transitions are triggered by attribute selectors.

## API Reference (First-Class Exports)

### `on(parent, event, selector, fn)`
Event delegation and message passing.
- `on(document.body, 'click', '.btn', fn)`
- `on.emit(el, 'custom-event', { detail })`

### `the(...)`
State management and rehydration.
- `the('key', 'value')` – Global state.
- `the(el, { expanded: true })` – Scoped state.

### `_t(key)`
Advanced `Intl` localization engine.
- `_t('cart_items', { qty: 5 })` – Standard ICU-like plurals.
- **Declarative:** `<span data-i18n="price" data-i18n-val="9.99" data-i18n-type="currency"></span>`

### `$(context, selector)`
Context-aware selector.
- `$.clone('#template')` – Instantiate templates.

### `$$(context, selector)`
Collection selector. Returns a **real Array**.

## Linter Rules (The Golden Standard)

| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **HTML-017** | `<div data-action="...">` | `<button>` or `role="button"` |
| **HTML-018** | `<input>` (No label) | `<label>` or `aria-label` |
| **JS-015** | `el.textContent = "..."` | `the(el, 'key', 'val')` |
| **JS-019** | `on(..., 'click', ...)` | Use `<form>` and `submit` |

## Contributing
See `AGENTS.md` for the roadmap and `LLM.md` for AI reference.
