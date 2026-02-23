# on_the_money.js 💸

An opinionated web project **Anti-Framework** that enforces a deterministic, DOM-first approach using native browser APIs and strict architectural constraints.

## Core Features

- **DOM as Database**: Application state is reflected in attributes on DOM elements.
- **Pure Templating**: `$.clone('#template')` returns standard DOM elements for native manipulation.
- **State Persistence**: `the()` manages state and automatically syncs with `localStorage`.
- **Reactivity**: `data-text="key"` automatically syncs state to text content.
- **CSS as UI Engine**: Visual transitions are triggered by attribute selectors.
- **Deterministic Localization**: UI text is populated via `_t()` or `data-i18n`.

## API Reference (First-Class Exports)

### `on(parent, event, selector, fn)`
Standard event delegation.
- `on(document.body, 'click', '.btn', fn)`
- `on.emit(el, 'custom-event', { detail })`

### `the(...)`
State management and rehydration.
- `the('key', 'value')` – Global state on `<body>`.
- `the(el, { expanded: true })` – Scoped state and ARIA mapping.

### `_t(key)`
Localization engine.
- `_t('save')` – Returns translation.
- `_t()` – Hydrates all `data-i18n` elements.

### `$(context, selector)`
Context-aware selector.
- `$(container, '.item')`
- `$.clone('#template')` – Clones and returns first element.

### `$$(context, selector)`
Collection selector. Returns a **real Array**.
- `$$('.items').filter(el => ...)`

## Linter Rules

| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **JS-001** | `el.innerHTML = "..."` | `const el = $.clone('#tmp');` |
| **JS-002** | `let status = 'active'` | `the('status', 'active')` |
| **JS-003** | `el.style.display = 'none'` | `the(el, 'hidden', 'true')` |
| **JS-015** | `el.textContent = "..."` | `the(el, 'key', 'val')` |

## Contributing
See `AGENTS.md` for the roadmap and `LLM.md` for AI reference.
