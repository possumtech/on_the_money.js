# on_the_money.js

Opinionated, attribute-driven, standards-oriented modern framework. <2KB gzip. Native browser APIs only. ESNext.

## Mandates
- **DOM is the database.** State lives in attributes. Reads/writes via `the()`.
- **CSS is the UI engine.** No `.style` mutation. Drive transitions from attribute selectors.
- **A11y by construction.** Interactive elements get roles + labels. ARIA states are first-class.
- **Conventions live in HTML.** `data-text`, `data-i18n`, `data-action`, `data-external`, `data-item` — readable, inspectable, native.
- **Standards-aligned.** No JSX, no virtual DOM, no transpilation. ES modules and the platform.

## Install
```bash
npm install on_the_money
```

## Exports
```javascript
import { on, the, _t, route, $, $$ } from "on_the_money";
```
Aliases on `the`: `the.t === _t`, `the.route === route`, `the.form(formEl)`, `the.boot(options?)`.

## API

### `on(parent, event, selector, fn)` — event delegation
- `parent`: `Element` | selector string | falsy (→ `document.body`).
- Listener attaches to `parent`; `fn(event, target)` fires when `event.target.closest(selector)` is inside `parent`.

### `on.emit(el, event, detail)` — `CustomEvent` dispatch
- `el`: `Element` | selector string. Dispatches `{ bubbles: true, cancelable: true, detail }`.

### `the(...)` — state
Element-first-arg dispatch. Three disjoint shapes per scope: get, set, batch. Global state is body `data-*` + `localStorage["otm:KEY"]`; scoped state is `data-*` on a specific element.

| Call | Behavior | Returns |
| --- | --- | --- |
| `the(key)` | Read global attribute on `document.body`. | `string \| null` |
| `the(key, val)` | Write global: body attr + `localStorage["otm:KEY"]` + descendant `[data-text="key"]`. | `document.body` |
| `the({ k: v, ... })` | Batch global write. | `document.body` |
| `the(el, key)` | Read scoped attribute on `el`. | `string \| null` |
| `the(el, key, val)` | Write scoped attribute on `el` + descendant `[data-text="key"]`. | `el` |
| `the(el, { k: v, ... })` | Batch scoped write. | `el` |

- **Dispatch:** if `args[0] instanceof Element`, scoped; else if string, global key; else if plain object, batch global; else throws.
- **`the(key, undefined)` throws** (`val is required for set`). Two args means set; missing val is a contract violation.
- **ARIA mapping** (key → attribute): `expanded`, `selected`, `hidden`, `checked`, `disabled` → `aria-*`. All other keys → `data-*`.
- **Values MUST be flat primitives.** Nested objects rejected.

### `the.form(formEl)` — form extraction
- Walks `input, select, textarea` descendants of `formEl`. Skips unnamed, disabled, submit/button/reset controls, and unchecked checkboxes/radios.
- Parses bracket-notation names: `user[name]` → nesting, `tags[]` → array append.
- Returns a nested object.

### `the.boot(options?)` — explicit init
Not auto-called. Run once from the consumer's entry point.

```javascript
await the.boot({ signal, locales, dictionary });
```
- `signal` — `AbortSignal` for the i18n fetch.
- `locales` — override the `<meta name="i18n" content>` path.
- `dictionary` — inline dictionary; skips the fetch entirely.

Steps:
1. Resolve locale: `?lang=` query param → `localStorage["otm:lang"]` → `navigator.language`. Assigns `The.locale`.
2. Resolve dictionary: inline `dictionary` option → `fetch(${path}/${target}.json)` if `<meta name="i18n">` (or `locales` option) is present. Falls back through full → base → `data-fallback`.
3. Replay `localStorage` `otm:KEY` entries (except `otm:lang`) onto body `data-*` and `[data-text="KEY"]`.
4. Run `_t()` to hydrate `[data-i18n]`.

Importing the module does nothing observable. No fetch, no localStorage read, no DOM mutation.

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

## Patterns

### Boot
```javascript
import { the } from "on_the_money";
await the.boot();   // rehydrate state, fetch i18n, hydrate [data-i18n]
```

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
