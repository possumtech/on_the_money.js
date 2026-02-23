# LLM.md: on_the_money.js 💸

This file provides high-signal instructions for LLMs building with `on_the_money.js`. 

## 1. Core Mandates
- **DOM is the Database:** State lives in attributes. Use `the()`.
- **CSS is the UI Engine:** No `.style` manipulation. Use attribute selectors.
- **Interactive Integrity:** All interactive elements need proper ARIA roles and labels.
- **Pure Standards:** ESNext only. No proprietary DSLs.

## 2. API Reference

### `on` (Events)
- `on(parent, event, selector, fn)`: Delegation. Default parent is `document.body`.
- `on.emit(el, event, detail)`: Native `CustomEvent` dispatch.

### `the` (Data & State)
- `the(key, val)`: Set global state (auto-syncs to `localStorage`).
- `the(el, key, val)`: Set scoped state. Returns `el`.
- `the(el, { k: v })`: Batch set state. Returns `el`.
- `the.ready`: Promise that resolves after Handshake (rehydration + i18n fetch).
- **Mapping:** Maps `expanded`, `hidden`, `selected`, `checked` to `aria-*`.
- **Constraint:** Values must be **FLAT** primitives.

### `_t` (Localization)
- `_t(key, options)`: Returns string using `Intl`.
- `_t()`: Hydrates `data-i18n` elements.
- **Auto-Boot:** Presence of `<meta name="i18n" content="/locales">` triggers automatic fetch of `{lang}.json`.

### `$` (DOM)
- `$(context, selector)`: Context-aware find.
- `$$(context, selector)`: Returns real **Array**.
- `$.clone(selector)`: Instantiates a `<template>`.

## 3. Gold Standard Patterns

### Initialization
```javascript
import { the } from 'on_the_money.js';
await the.ready; // Ensure i18n and state are rehydrated
```

### List Rendering
```javascript
container.append(...items.map(i => the($.clone('#tmp'), i)));
```

### Reactive Text
```html
<h1 data-text="user-name"></h1>
```
```javascript
the('user-name', 'Alice'); // <h1> updates automatically
```

## 4. Illegal Slop (Linter Rules)
- `innerHTML` / `outerHTML`
- `el.style.*`
- assignments to `textContent`, `innerText`, `nodeValue`.
- `addEventListener` (Use `on()`).
- Nested objects in `the()`.
- Missing roles/tabindex on `data-action` targets.
- Input elements without labels.
- Missing `lang`, `charset`, or `viewport` tags.
- Missing `<meta name="i18n" ...>` when `data-i18n` is present.
- Prefer `submit` events over button `click` for data gathering.
