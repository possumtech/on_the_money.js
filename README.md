# on_the_money.js 💸

An opinionated web project **Anti-Framework** that enforces a deterministic, DOM-first approach using native browser APIs and strict architectural constraints.

## Core Features

- **DOM as Database**: Application state is reflected in attributes on DOM elements.
- **ARIA as State**: Standard `aria-` attributes are preferred for UI state (e.g., `aria-expanded`).
- **CSS is the UI Engine**: Visual changes are handled by CSS attribute selectors, never by JS style manipulation.
- **No String Injection**: `innerHTML` is forbidden. Use `<template>` cloning for dynamic content.
- **Deterministic Localization**: UI text must be keyed through `_t()` or `data-i18n`.
- **Persistence**: Scoped and global state is persisted in `localStorage` for rehydration.
- **Custom Linter**: A syntax-tree-based linter enforces these constraints across HTML, JS, and CSS.

## API Reference (Under Design)

### `on(parent, event, selector, callback)`
Event delegation handler.

### `the(...)`
Overloaded helper for state and templating:
- `the('key', 'value')` – Sets global state on `<body>`.
- `the('.selector', 'key', 'value')` – Sets scoped state on matched elements.
- `the('#template-id', data)` – Clones a template and stamps it with data attributes.

### `$()` and `$$()`
- `$(selector)` returns the first matching element.
- `$$(selector)` returns an Array of matching elements.

### `_t(key)`
Localization engine. Automatically populates `data-i18n` elements.

## Linter Rules

### JavaScript (JS)
| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **JS-001** | `el.innerHTML = "..."` | `the('#template', data)` |
| **JS-002** | `let status = 'active'` | `the('status', 'active')` |
| **JS-003** | `el.style.display = 'none'` | `the(el, 'visible', 'false')` + CSS |
| **JS-009** | `dynamicEl.addEventListener()` | `on(parent, 'click', selector, fn)` |

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
