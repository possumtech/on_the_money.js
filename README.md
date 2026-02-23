# on_the_money.js 💸

An opinionated web project **Anti-Framework** that enforces a deterministic, DOM-first approach using native browser APIs and strict architectural constraints.

## Core Features

- **DOM as Database**: Application state is reflected in attributes on DOM elements.
- **Fluent Delegation**: `on().click(selector, fn)` defaults to `document.body` for concision.
- **State Persistence**: `the()` manages state attributes and automatically syncs with `localStorage`.
- **Pure Templating**: `clone('#template')` returns standard DOM elements for native manipulation.
- **CSS as UI Engine**: Visual transitions are triggered by attribute selectors.
- **Deterministic Localization**: UI text is populated via `_t()` or `data-i18n`.

## API Reference (Under Design)

### `on(parent)`
Fluent event delegation handler. Implemented in `src/core/On.js`.
- `on().click('.btn', fn)` – Body delegation.
- `on('#menu').hover('.item', fn)` – Scoped delegation.

### `the(...)`
State management and rehydration. Implemented in `src/core/The.js`.
- `the('key', 'value')` – Sets global state on `<body>`.
- `the(el, 'expanded', true)` – Sets scoped state on `el` and maps to `aria-expanded`.

### `clone(selector)`
Templates without the magic. Implemented in `src/core/Clone.js`.
- `const card = clone('#user-card');` – Clones and returns the first element.

### `$()` and `$$()`
Selectors implemented in `src/core/Select.js`.
- `$(context, selector)` – Context defaults to `document`.

### `_t(key)`
Localization engine implemented in `src/core/Translate.js`.

## Linter Rules

### JavaScript (JS)
| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **JS-001** | `el.innerHTML = "..."` | `const el = clone('#tmp');` |
| **JS-002** | `let status = 'active'` | `the('status', 'active')` |
| **JS-003** | `el.style.display = 'none'` | `the(el, 'hidden', 'true')` + CSS |
| **JS-009** | `el.addEventListener()` | `on().click(selector, fn)` |

### HTML (HTML)
| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **HTML-004** | `<span>Submit</span>` | `<span data-i18n="btn_submit"></span>` |
| **HTML-013** | `<div class="button">` | `<button type="button">` |
| **HTML-014** | `onclick="handle()"` | `data-action="handle"` + JS delegation |

### CSS (CSS)
| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **CSS-012** | `.is-active { ... }` | `[aria-selected="true"] { ... }` |
| **CSS-006** | `!important` | Refactor specificity |

## Contributing
See `AGENTS.md` for the implementation plan.
