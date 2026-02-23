# on_the_money.js 💸

An opinionated web project **Anti-Framework** that enforces a deterministic, DOM-first approach using native browser APIs and strict architectural constraints.

## Core Features

- **DOM as Database**: Application state is reflected in attributes on DOM elements.
- **Message Passing**: `on(parent, event, selector, fn)` and `on.emit()` for decoupling.
- **State Persistence**: `the()` manages state and automatically syncs with `localStorage`.
- **Reactivity without Virtual DOM**: `data-text="key"` automatically syncs state to text content.
- **Map & Append**: `container.append(...data.map(d => the($.clone('#tmp'), d)))` for lists.
- **CSS as UI Engine**: Visual transitions are triggered by attribute selectors.
- **Deterministic Localization**: UI text is populated via `the._t()` or `data-i18n`.

## API Reference (Under Design)

### `on(parent, event, selector, fn)`
Event delegation and message passing.
- `on(document.body, 'click', '.btn', fn)`
- `on.emit(el, 'custom-event', { detail })`

### `the(...)`
State management and rehydration.
- `the('key', 'value')` – Global state on `<body>`.
- `the(el, { expanded: true, selected: false })` – Sets multiple states and returns `el`.
- **Automatic Sync:** Elements with `data-text="key"` are updated automatically.

### `$()` and `$$()`
Selectors and instantiation.
- `$(context, selector)` – Context-aware selection.
- `$.clone('#template')` – Returns the first element of a template.

### `the._t(key)`
Localization engine (aliased as `_t`).

## Linter Rules

### JavaScript (JS)
| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **JS-001** | `el.innerHTML = "..."` | `const el = $.clone('#tmp');` |
| **JS-002** | `let status = 'active'` | `the('status', 'active')` |
| **JS-003** | `el.style.display = 'none'` | `the(el, 'hidden', 'true')` + CSS |
| **JS-009** | `el.addEventListener()` | `on(parent, event, selector, fn)` |
| **JS-015** | `el.textContent = "..."` | `the(el, 'key', 'val')` |

## Contributing
See `AGENTS.md` for the implementation plan and `THEORY.md` for our philosophy.
