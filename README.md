# on_the_money.js 💸

An opinionated web project **Anti‑Framework** that provides the ergonomic benefits of modern frameworks using only native browser APIs and strict architectural constraints. It includes a **hybrid linting system** with both a standalone CLI and ESLint plugin to enforce deterministic constraints across your entire project.

## Features

- **DOM as Database**: Application state is reflected in `data‑` attributes on DOM elements.
- **CSS as UI Engine**: Visual changes (hiding, showing, coloring) are handled by CSS attribute selectors, never by JavaScript style manipulation.
- **No String Injection**: `innerHTML` is forbidden. Use `<template>` cloning for dynamic content.
- **Deterministic Localization**: Hard‑coded strings are errors. All UI text must be keyed through `_t()` or `data‑i18n`.
- **Inclusive by Design**: Every state change must consider a11y (ARIA) parity.
- **Built‑in Linter**: ESLint plugin enforces the architectural constraints (OTM‑001 … OTM‑005).

## Installation

### Client‑side Library

**Via CDN (script tag):**
```html
<script src="https://unpkg.com/on_the_money.js@0.1.1/dist/on_the_money.min.js"></script>
```

**As an ES module (npm):**
```bash
npm install on_the_money.js
```
```javascript
import 'on_the_money.js';
```

### Server‑side Linter (ESLint plugin)

```bash
npm install --save-dev eslint-plugin-on-the-money
```

Add to your ESLint configuration:

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['on-the-money'],
  rules: {
    'on-the-money/otm-001': 'error',
    'on-the-money/otm-002': 'error',
    'on-the-money/otm-003': 'error',
    'on-the-money/otm-004': 'error',
    'on-the-money/otm-005': 'error',
  }
};
```

### Standalone CLI

For quick one‑off checks, CI/CD pipelines, or non‑JavaScript projects, you can use the standalone CLI:

```bash
npx on_the_money.js --check
```

To install globally:

```bash
npm install -g on_the_money.js
```

Then run:

```bash
otm-lint --check ./src
```

The CLI supports the same five OTM rules and can check HTML, CSS, and JavaScript files.

## Quick Start

1. **Set up state management**
   ```javascript
   // Set global state (persists to localStorage)
   the('theme', 'dark');

   // Set scoped state on a specific element
   the('.menu', 'open', 'true');
   ```

2. **Create templates**
   ```html
   <template id="todo-item">
     <li data-i18n="todo_item">
       <button data-action="complete">Complete</button>
     </li>
   </template>

   <script type="module">
     const todo = { id: 1, text: 'Buy milk' };
     const element = the('#todo-item', todo);
     document.querySelector('#todo-list').appendChild(element);
   </script>
   ```

3. **Style with CSS**
   ```css
   [data-theme="dark"] {
     background: #000;
     color: #fff;
   }

   .menu[data-open="true"] {
     transform: translateX(0);
   }

   .menu[data-open="true"][aria-expanded="true"] {
     /* ARIA parity enforced by OTM‑005 */
   }
   ```

## API Reference

### `on(parent, event, selector, callback)`
Event delegation handler. Attaches a listener to `parent` that fires `callback` when `event` occurs on an element matching `selector`.

### `the(...args)`
- `the('key', 'value')` – Sets a global `data‑key` attribute on `<body>` and persists it to `localStorage`.
- `the('.selector', 'key', 'value')` – Sets a scoped `data‑key` attribute on the element(s) matched by `selector`.
- `the('#template-id', dataObject)` – Clones the `<template>` with `id="template-id"`, stamps `dataObject` onto it as `data‑` attributes, and returns the live DOM node.

### `$(selector)` and `$$(selector)`
- `$(selector)` returns the first matching element.
- `$$(selector)` returns a real **Array** of matching elements (not a NodeList).

### `_t(key)`
Localization engine. Returns the localized string for `key`. Automatically populates `innerText` of any element with a `data‑i18n` attribute.

## Linter Rules

The ESLint plugin enforces the deterministic patterns described in SPEC.md:

| Rule ID | Forbidden Pattern | Correct Pattern |
| :--- | :--- | :--- |
| **OTM‑001** | `el.innerHTML = "..."` | `the('#template', data)` |
| **OTM‑002** | `let status = 'active'` (UI state) | `the('status', 'active')` |
| **OTM‑003** | `el.style.display = 'none'` | `the(el, 'visible', 'false')` + CSS |
| **OTM‑004** | `<span>Submit</span>` (naked strings) | `<span data‑i18n="btn_submit"></span>` |
| **OTM‑005** | `the(el, 'open', true)` without ARIA | Must include corresponding ARIA attribute (e.g., `aria‑expanded="true"`) |

## Persistence & Rehydration

All **Global State** (attributes on `<body>`) is automatically mirrored in `localStorage`. On page load, `on_the_money.js` performs a **Handshake**: it reads the `localStorage` table and re‑applies every `data‑` attribute to the `<body>` before the first frame paints.

## CSS Standard

All CSS must react to the state provided by `the()`. Example:

```css
/* Good: Deterministic & Decoupled */
[data-theme="dark"] { background: #000; }
.menu[aria-expanded="open"] { transform: translateX(0); }

/* Bad: Imperative & Hardcoded */
.is-active { display: block; }
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
