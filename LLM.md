# LLM.md: on_the_money.js 💸

This file provides high-signal instructions for LLMs building with `on_the_money.js`. 

## 1. Core Mandates
- **DOM is the Database:** Never store state in JS variables. Use `the()`.
- **CSS is the UI Engine:** Never manipulate `.style`. Use attribute selectors.
- **No DSLs:** Use standard HTML/CSS. No `{{}}`, no `v-if`.
- **Pure Standards:** ESNext only. No polyfills.

## 2. First-Class API

### `on` (Events)
- `on(parent, event, selector, fn)`: Event delegation.
- `on.emit(el, event, detail)`: Dispatch `CustomEvent`.

### `the` (State)
- `the(key, val)`: Set global state on `<body>`.
- `the(el, key, val)`: Set scoped state on `el`. Returns `el`.
- `the(el, { k: v })`: Set multiple states. Returns `el`.

### `_t` (Localization)
- `_t(key)`: Returns translated string.
- `_t()`: Hydrates all `data-i18n` elements.

### `$` (DOM)
- `$(context, selector)`: Find first element.
- `$.clone(selector)`: Clone `<template>`. Returns first element node.

### `$$` (Collections)
- `$$(context, selector)`: Returns a real **Array**.

## 3. Mandatory Patterns

### List Rendering (Map & Append)
```javascript
const items = [{id: 1, name: 'A'}];
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
- `innerHTML` / `outerHTML`
- `el.style.*`
- `addEventListener`
- `textContent` / `innerText`
- Nested objects in `the()` (State must be flat)
- Class selectors in CSS for state
- `!important` in CSS
