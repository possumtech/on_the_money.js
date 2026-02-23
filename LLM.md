# LLM.md: on_the_money.js 💸

This file provides high-signal instructions for LLMs building with `on_the_money.js`. 

## 1. Core Mandates
- **DOM is the Database:** Never store state in JS variables. Use `the()`.
- **CSS is the UI Engine:** Never manipulate `.style`. Use attribute selectors.
- **No DSLs:** Use standard HTML/CSS. No `{{}}`, no `v-if`.
- **Pure Standards:** ESNext only. No polyfills.

## 2. The Three Pillars (API)

### `on` (Events)
- `on(parent, event, selector, fn)`: Event delegation. Default parent is `document.body`.
- `on.emit(el, event, detail)`: Dispatch `CustomEvent`.

### `the` (Data & State)
- `the(key, val)`: Set global state on `<body>`.
- `the(el, key, val)`: Set scoped state on `el`. Returns `el`.
- `the(el, { k: v })`: Set multiple states. Returns `el`.
- `the.t(key)`: Localize string (alias: `_t`).
- **Constraint:** Values must be **FLAT** (string, number, boolean). No objects/arrays.

### `$` (DOM)
- `$(context, selector)`: Find first element. Default context is `document`.
- `$$(context, selector)`: Find all elements. Returns a REAL **Array**.
- `$.clone(selector)`: Clone `<template>`. Returns first element node.

## 3. Mandatory Patterns

### List Rendering (Map & Append)
```javascript
const items = [{id: 1, name: 'A'}, {id: 2, name: 'B'}];
container.append(...items.map(i => the($.clone('#tmp'), i)));
```

### Text Reactivity
```html
<h1 data-text="user-name"></h1>
```
```javascript
the('user-name', 'Alice'); // Updates <h1> automatically
```

## 4. Illegal Slop (Linter Rules)
The following patterns are **Strictly Forbidden**:
- `innerHTML` / `outerHTML` (Use `$.clone`)
- `el.style.*` (Use `the()` + CSS)
- `addEventListener` (Use `on()`)
- `textContent` / `innerText` (Use `data-text` or `data-i18n`)
- Nested objects in `the()` (State must be flat)
- Class selectors in CSS for state (Use `[aria-*]` or `[data-*]`)
- `!important` in CSS

## 5. Metadata
- **Gzipped Size:** < 1KB
- **Philosophy:** Anti-Framework / Anti-Slop
- **Source of Truth:** Native DOM Attributes
