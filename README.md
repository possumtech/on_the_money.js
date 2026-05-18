# on_the_money.js

DOM-first anti-framework. <2KB gzip. Native browser APIs only. ESNext.

## Mandates
- **DOM is the database.** State lives in attributes. Reads/writes via `the()`.
- **CSS is the UI engine.** No `.style` mutation. Drive transitions from attribute selectors.
- **A11y by construction.** Interactive elements get roles + labels. ARIA states are first-class.
- **Standards only.** No DSLs. No JSX. No virtual DOM. ES modules.

## Install
```bash
npm install on_the_money
```

## Exports
```javascript
import { on, the, _t, route, $, $$ } from "on_the_money";
```
Aliases: `the.t === _t`, `the.route === route`, `the.form(el)` extracts form data.

## API

### `on(parent, event, selector, fn)` — event delegation
- `parent`: `Element` | selector string | falsy (→ `document.body`).
- Listener attaches to `parent`; `fn(event, target)` fires when `event.target.closest(selector)` is inside `parent`.

### `on.emit(el, event, detail)` — `CustomEvent` dispatch
- `el`: `Element` | selector string. Dispatches `{ bubbles: true, cancelable: true, detail }`.

### `the(...)` — state
Polymorphic. Global state is body `data-*` + `localStorage["otm:KEY"]`.

| Call | Behavior |
| --- | --- |
| `the(key)` | Read global attribute on `document.body`. |
| `the(key, val)` | Write global: body attr + `localStorage["otm:KEY"]` + all `[data-text="key"]`. |
| `the({ k: v, ... })` | Batch global write. |
| `the(el, key)` | Read scoped attribute on `el`. |
| `the(el, key, val)` | Write scoped attribute on `el` + descendant `[data-text="key"]`. |
| `the(el, { k: v, ... })` | Batch scoped write. |
| `the(formEl)` / `the.form(formEl)` | Extract `FormData` into nested object. Supports `user[name]`, `tags[]`. |

- `the.ready` — `Promise` that resolves when the Handshake (rehydration + i18n fetch) completes.
- **ARIA mapping** (key → attribute): `expanded`, `selected`, `hidden`, `checked`, `disabled` → `aria-*`. All other keys → `data-*`.
- **Values MUST be flat primitives.** Nested objects are illegal.

### `_t(key, options)` — `Intl` localization
- `_t(key, options)` → string from `The.dictionary[key]` with `{var}` interpolation.
  - `options.qty` (number) → `Intl.PluralRules` selection across `{ one, other, ... }` entries.
  - `options.type` = `"currency"` | `"date"` + `options.val` → formatted via `Intl.NumberFormat` / `Intl.DateTimeFormat` under `The.locale`.
- `_t(node)` — hydrate every `[data-i18n]` inside `node`. Reads `data-i18n-*` attrs as `options`; `data-i18n-type` selects the formatter.
- `_t()` — hydrate `document.body`. Missing dictionary keys preserve existing `textContent` (SEO fallback).

### `route(callback)` — pushState router
- `callback(pathname, search, hash)` fires on `popstate`, `hashchange`, and intercepted internal `<a>` clicks.
- Skip interception: `data-external` attribute, `target="_blank"`, or cross-origin `href`.
- Same-page hash-only links are left to the browser; `hashchange` still triggers `callback`.

### `$(context, selector)` / `$$(context, selector)` — context-aware DOM query
- `context`: `Element` | `Document` | selector string (then `context = document`).
- `$` returns one element (or `null`); `$$` returns a real `Array`.

### `$.clone(parent, selector)` — template instantiation
- Clones first element from `<template>` matched by `selector`, runs `_t(el)` for i18n hydration, appends to `parent`, dispatches `mounted` `CustomEvent` (`bubbles: true`, `detail: { parent }`) on the new element. Returns the mounted element.
- `parent`: `Element` | selector string. Throws if `parent` or template is missing.

## Handshake (auto-runs on import in a browser)
1. Resolve locale: `?lang=` query param → `localStorage["otm:lang"]` → `navigator.language`. Assigns `The.locale`.
2. If `<meta name="i18n" content="/locales" data-available="en,fr" data-fallback="en">` is present, `fetch("/locales/{lang}.json")` and assign JSON to `The.dictionary`. Falls back through full → base → `data-fallback`.
3. Iterate `localStorage` and replay every `otm:KEY` (except `otm:lang`) back onto `document.body` `data-*` and `[data-text="KEY"]` elements.
4. Run `_t()` to hydrate `[data-i18n]`.

`await the.ready` to gate code on completion.

## Patterns

### Reactive text
```html
<h1 data-text="user"></h1>
```
```javascript
the("user", "Alice"); // <h1>Alice</h1>
```

### List rendering
```javascript
for (const item of items) the($.clone("#list", "#tmp"), item);
```

### Form intake
```javascript
on("#todo-form", "submit", (e) => {
  e.preventDefault();
  const data = the.form(e.target);                // { task, tags: [...] }
  the($.clone("#todo-list", "#todo-item"), data);
});
```

### Lifecycle hook
```javascript
on("#todo-list", "mounted", "[data-item]", (e) => {
  e.target.classList.add("fade-in");
});
```

## Illegal slop (linter rejects)
- `innerHTML`, `outerHTML`
- `el.style.*` assignments
- Assignments to `textContent`, `innerText`, `nodeValue` (use `the()` or `data-text`)
- `addEventListener` (use `on()`)
- Nested objects passed to `the()`
- `data-action` on elements missing `role`/`tabindex`
- `<input>` without an associated `<label>`
- Missing `<html lang>`, `<meta charset>`, `<meta name="viewport">`
- `data-i18n` without `<meta name="i18n">`
- Button `click` for data gathering — use `submit`

Run: `npm run otm` (lint) · `npm test` (node:test) · `npm run check` (lint + build + test + coverage).

## Layout
- `src/core/{On,The,Select}.js` — runtime
- `src/linter/` — `otm-lint` rules
- `test/*.test.js` — unit (`node --test`)
- `test/integration.test.js` — full-surface integration
- `examples/` — runnable samples
- `dist/on_the_money.min.js` — built ESM bundle

## License
MIT. Issues and PRs: https://github.com/possumtech/on_the_money.js
