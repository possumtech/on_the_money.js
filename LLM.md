# LLM.md: on_the_money.js 💸

This file provides high-signal instructions for LLMs building with `on_the_money.js`. 

## 1. Core Mandates
- **DOM is the Database:** Never store state in JS variables. Use `the()`.
- **CSS is the UI Engine:** Never manipulate `.style`. Use attribute selectors.
- **Interactive Integrity:** Every interactive element must have appropriate ARIA roles and labels.
- **Pure Standards:** ESNext only. Utilize native `Intl` for all localization.

## 2. First-Class API

### `on` (Events)
- `on(parent, event, selector, fn)`: Event delegation.
- `on.emit(el, event, detail)`: Dispatch `CustomEvent`.

### `the` (State)
- `the(key, val)`: Set global state on `<body>`.
- `the(el, key, val)`: Set scoped state on `el`. Returns `el`.
- **Constraint:** Values must be **FLAT**.

### `_t` (Localization)
- `_t(key, options)`: Returns translated string using `Intl`.
- `_t()`: Hydrates `data-i18n` elements.
- **Advanced Attributes:** `data-i18n-qty` (plurals), `data-i18n-val` (values), `data-i18n-type` (currency/date/number).

### `$` (DOM)
- `$(context, selector)`: Find first element.
- `$$(context, selector)`: Returns a real **Array**.
- `$.clone(selector)`: Clone `<template>`.

## 3. Mandatory Patterns

### List Rendering (Map & Append)
```javascript
container.append(...items.map(i => the($.clone('#tmp'), i)));
```

### Advanced Localization
```html
<!-- Native pluralization + currency formatting -->
<span data-i18n="cart_total" data-i18n-qty="5" data-i18n-val="99.99" data-i18n-type="currency"></span>
```

## 4. Illegal Slop (Linter Rules)
- `innerHTML` / `outerHTML`
- `el.style.*`
- `textContent` / `innerText` (Use `data-text` or `_t`)
- `addEventListener` (Use `on()`)
- Clickable non-interactive elements (Missing `role` or `tabindex`)
- Form inputs missing labels.
- `on(..., 'click', 'button', ...)` when it should be a `<form>` `submit`.
