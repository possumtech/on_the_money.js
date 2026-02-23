# on_the_money.js 💸

An opinionated web project **Anti-Framework** that enforces a deterministic, DOM-first approach using native browser APIs and strict architectural constraints.

## Core Features

- **DOM as Database**: Application state is reflected in attributes on DOM elements.
- **Event Delegation**: `on(parent, event, selector, fn)` for performant listeners.
- **Message Passing**: `emit(el, event, detail)` for decoupled components.
- **State Persistence**: `the()` manages state and automatically syncs with `localStorage`.
- **Reactivity without Virtual DOM**: `data-text="key"` automatically syncs state to text content.
- **Pure Templating**: `clone('#template')` returns standard DOM elements.
- **CSS as UI Engine**: Visual transitions are triggered by attribute selectors.
- **Deterministic Localization**: UI text is populated via `_t()` or `data-i18n`.

## API Reference (Under Design)

### `on(parent, event, selector, fn)`
Standard event delegation.
- `on(document.body, 'click', '.btn', fn)`

### `emit(el, event, detail)`
Native `CustomEvent` dispatcher.

### `the(...)`
State management and rehydration.
- `the('key', 'value')` – Global state on `<body>`.
- `the(el, 'expanded', true)` – Scoped state and ARIA mapping.
- **Automatic Sync:** Elements with `data-text="key"` are updated automatically.

### `clone(selector)`
Templates without the magic.
- `const card = clone('#user-card');` – Clones and returns the first element.

### `$()` and `$$()`
Context-aware selectors.
- `$(context, selector)` – Context defaults to `document`.

### `_t(key)`
Localization engine.

## Linter Rules

### JavaScript (JS)
| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **JS-001** | `el.innerHTML = "..."` | `const el = clone('#tmp');` |
| **JS-002** | `let status = 'active'` | `the('status', 'active')` |
| **JS-003** | `el.style.display = 'none'` | `the(el, 'hidden', 'true')` + CSS |
| **JS-009** | `el.addEventListener()` | `on(parent, event, selector, fn)` |

### HTML (HTML)
| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **HTML-004** | `<span>Submit</span>` | `<span data-i18n="btn_save"></span>` |
| **HTML-013** | `<div class="button">` | `<button type="button">` |
| **HTML-014** | `onclick="handle()"` | `data-action="handle"` + JS delegation |

### CSS (CSS)
| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **CSS-012** | `.is-active { ... }` | `[aria-selected="true"] { ... }` |
| **CSS-006** | `!important` | Refactor specificity |

## Contributing
See `AGENTS.md` for the implementation plan.
