# on_the_money.js 💸

An opinionated web project **Anti‑Framework** that provides the ergonomic benefits of modern frameworks using only native browser APIs and strict architectural constraints. It includes a **hybrid linting system** with both a standalone CLI and ESLint plugin to enforce deterministic constraints across your entire project.

## Features

- **DOM as Database**: Application state is reflected in `data‑` attributes on DOM elements.
- **CSS as UI Engine**: Visual changes (hiding, showing, coloring) are handled by CSS attribute selectors, never by JavaScript style manipulation.
- **No String Injection**: `innerHTML` is forbidden. Use `<template>` cloning for dynamic content.
- **Deterministic Localization**: Hard‑coded strings are errors. All UI text must be keyed through `_t()` or `data‑i18n`.
- **Inclusive by Design**: Accessibility (ARIA) takes precedence over custom data attributes.
- **Semantic HTML**: Proper HTML elements must be used for their intended purpose.
- **Built‑in Linter**: Multi‑file‑type linter enforces architectural constraints across HTML, JavaScript, and CSS.

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
    // JavaScript Rules
    'on-the-money/js/no-inner-html': 'error',          // OTM-001
    'on-the-money/js/state-in-dom': 'error',           // OTM-002  
    'on-the-money/js/no-direct-style': 'error',        // OTM-003
    'on-the-money/js/prefer-aria': 'warn',             // OTM-005
    'on-the-money/js/event-delegation': 'error',       // OTM-009
    'on-the-money/js/no-dynamic-attribute-names': 'error', // OTM-011
    
    // HTML Rules (via eslint-plugin-html)
    'on-the-money/html/no-naked-strings': 'error',     // OTM-004
    'on-the-money/html/semantic-elements': 'warn',     // OTM-013
    'on-the-money/html/no-inline-handlers': 'error',   // OTM-014
    
    // CSS Rules (via stylelint)
    'on-the-money/css/attribute-selectors': 'warn',    // OTM-012
  }
};
```

### Standalone CLI

For quick one‑off checks, CI/CD pipelines, or non‑JavaScript projects:

```bash
npx on_the_money.js --check ./src
```

To install globally:

```bash
npm install -g on_the_money.js
```

Then run:

```bash
otm-lint --check ./src
```

The CLI supports checking all file types (HTML, JS, CSS) with the same rules.

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
     <li>
       <span data-i18n="todo_item_text"></span>
       <button data-action="complete" aria-label="Complete task">
         <span data-i18n="btn_complete"></span>
       </button>
     </li>
   </template>

   <script type="module">
     const todo = { id: 1, textKey: 'buy_milk' };
     const element = the('#todo-item', todo);
     document.querySelector('#todo-list').appendChild(element);
   </script>
   ```

3. **Style with CSS**
   ```css
   /* Good: Attribute selectors for state */
   [data-theme="dark"] {
     background: #000;
     color: #fff;
   }

   [aria-expanded="true"] {
     transform: translateX(0);
   }

   /* Works perfectly with Pico CSS! */
   button[data-variant="primary"] {
     --pico-primary: #ff6b6b;
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
Localization engine. Returns the localized string for `key`. Automatically populates `innerText` of any element with a `data-i18n` attribute.

## Linter Rules

### JavaScript Rules

| Rule ID | Forbidden Pattern | Correct Pattern | Severity |
| :--- | :--- | :--- | :--- |
| **JS‑001** | `el.innerHTML = "..."` | `the('#template', data)` | error |
| **JS‑002** | `let status = 'active'` (UI state) | `the('status', 'active')` | error |
| **JS‑003** | `el.style.display = 'none'` | `the(el, 'visible', 'false')` + CSS | error |
| **JS‑005** | `data-expanded="true"` | `aria-expanded="true"` (for accessibility states) | warn |
| **JS‑009** | `dynamicEl.addEventListener()` | `on(parent, 'click', selector, fn)` | error |
| **JS‑011** | `el.setAttribute('data-' + key, value)` | Static attribute names only | error |

### HTML Rules

| Rule ID | Forbidden Pattern | Correct Pattern | Severity |
| :--- | :--- | :--- | :--- |
| **HTML‑004** | `<span>Submit</span>` | `<span data‑i18n="btn_submit"></span>` | error |
| **HTML‑013** | `<div class="button">` | `<button type="button">` | warn |
| **HTML‑014** | `onclick="handle()"` | `data-action="handle"` + JS event delegation | error |

### CSS Rules

| Rule ID | Forbidden Pattern | Correct Pattern | Severity |
| :--- | :--- | :--- | :--- |
| **CSS‑012** | `.is-active { display: block }` | `[data-active="true"] { display: block }` | warn |
| **CSS‑006** | `!important` | Refactor specificity | error |

## Persistence & Rehydration

All **Global State** (attributes on `<body>`) is automatically mirrored in `localStorage`. On page load, `on_the_money.js` performs a **Handshake**: it reads the `localStorage` table and re‑applies every `data‑` attribute to the `<body>` before the first frame paints.

## Compatibility with Pico CSS

`on_the_money.js` works perfectly with Pico CSS's classless approach:

1. **Semantic HTML**: Both enforce proper HTML element usage
2. **Attribute‑based styling**: Use `[data-*]` selectors alongside Pico's semantic selectors
3. **CSS Variables**: Set theme variables via `the()`: `the('theme', 'dark')` → `[data-theme="dark"] { --pico-primary: ... }`
4. **No Class Conflicts**: Since Pico doesn't require classes, you're free to use `data-*` attributes exclusively for state

## Gradual Adoption

Enable rules incrementally in your `.eslintrc.js`:

```javascript
module.exports = {
  plugins: ['on-the-money'],
  rules: {
    // Start with these critical rules
    'on-the-money/js/no-inner-html': 'error',
    'on-the-money/html/no-naked-strings': 'error',
    
    // Add these after initial cleanup
    'on-the-money/js/no-direct-style': 'warn',
    'on-the-money/html/semantic-elements': 'warn',
    
    // Enable these when ready for full compliance
    'on-the-money/js/event-delegation': 'error',
    'on-the-money/css/attribute-selectors': 'warn',
  }
};
```

Use disable comments for exceptional cases:
```javascript
// eslint-disable-next-line on-the-money/js/no-inner-html
el.innerHTML = trustedSanitizedHTML; // Legacy integration
```

## Test Suite

Run the test suite to verify your code follows on_the_money.js principles:

```bash
npm test
```

Or check specific files:

```bash
otm-lint --check ./src/components
otm-lint --check ./src --ext .html,.js,.css
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
