# on_the_money.js

Opinionated, attribute-driven, standards-oriented modern framework for the web. <2KB gzip. Native browser APIs only. ESNext.

State lives in DOM attributes. Reactivity comes from `[data-text]` and `[data-i18n]` selectors. Events use one delegated listener per `(parent, type)` pair. Routing uses the History API. Localization uses `Intl`. There is no virtual DOM, no JSX, no transpilation step, no proprietary tooling. The framework is a thin layer of conventions over the platform.

## Install

```bash
npm install on_the_money
```

## Quickstart

A complete two-file app. `index.html` carries semantic structure, `app.js` carries behavior.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title data-i18n="app_title"></title>
  <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@2/css/pico.classless.min.css">
  <script type="module" src="./app.js"></script>
</head>
<body>
  <main>
    <h1 data-i18n="app_title"></h1>
    <p>Hello, <strong data-text="user">friend</strong>.</p>
    <button data-action="greet">Greet</button>
  </main>
</body>
</html>
```

```javascript
// app.js
import { the, on } from "on_the_money";

await the.boot({
  dictionary: { app_title: "On The Money" },
});

on("main", "click", '[data-action="greet"]', () => {
  the("user", "Alice");
});
```

The framework rehydrates body `data-*` and `[data-text]` from `localStorage` on boot; subsequent `the()` writes both the attribute and persist to `localStorage["otm:KEY"]`.

## Pico Classless integration

Pico Classless is the recommended companion stylesheet. It styles semantic HTML directly — no classes, no JS. Include the stylesheet once:

```html
<link rel="stylesheet" href="https://unpkg.com/@picocss/pico@2/css/pico.classless.min.css">
```

Then write semantic HTML (`<main>`, `<nav>`, `<article>`, `<form>`, `<button>`, `<input>` with `<label>`, etc.). on_the_money's conventions all use `data-*` and `aria-*` attributes, so they layer cleanly under Pico's element-targeted CSS.

## Exports

```javascript
import { on, the, _t, route, $, $$ } from "on_the_money";
```

Aliases on `the`: `the.t === _t`, `the.route === route`, `the.form(formEl)`, `the.flat(obj, sep?)`, `the.boot(options?)`.
Live accessors on `the`: `the.dictionary`, `the.locale`.

## API

### `on(parent, event, selector, fn)` — event delegation

| Arg | Type | Notes |
| --- | --- | --- |
| `parent` | `Element \| string \| null` | If string, resolved via `document.querySelector`. If falsy, defaults to `document.body`. |
| `event` | `string` | Any DOM event name (`"click"`, `"submit"`, `"mounted"`, etc.). |
| `selector` | `string` | CSS selector matched via `event.target.closest(selector)`. |
| `fn` | `(event, target) => void` | `target` is the element the selector matched. |

Returns an `() => void` unsubscribe function.

```javascript
const off = on("#list", "click", "[data-action='delete']", (e, target) => {
  target.closest("[data-item]").remove();
});
off(); // detaches the listener
```

### `on.emit(el, event, detail)` — `CustomEvent` dispatch

Dispatches a bubbling, cancelable `CustomEvent` on `el`. `el` may be an element or a selector string.

```javascript
on.emit("#cart", "items-changed", { count: 3 });
```

### `the(...)` — state

Polymorphic on a single disambiguator: `args[0] instanceof Element`. Three call shapes per scope (get, set, batch).

| Call | Behavior | Returns |
| --- | --- | --- |
| `the(key)` | Read body `data-KEY` (or aria-mapped equivalent). | `string \| null` |
| `the(key, val)` | Write body attribute + `localStorage["otm:KEY"]` + descendant `[data-text="key"]`. | `document.body` |
| `the({ k: v, ... })` | Batch global write. | `document.body` |
| `the(el, key)` | Read scoped attribute on `el`. | `string \| null` |
| `the(el, key, val)` | Write scoped attribute on `el` + descendant `[data-text="key"]`. | `el` |
| `the(el, { k: v, ... })` | Batch scoped write. | `el` |

- **ARIA mapping** (key → attribute): `expanded`, `selected`, `hidden`, `checked`, `disabled` → `aria-*`. All other keys → `data-*`.
- **Booleans coerce** to `"true"`/`"false"` inside the setter. `the(el, "checked", true)` writes `"true"`.
- **Values MUST be flat primitives.** Pass nested objects through `the.flat(...)` first.
- **`the(key, undefined)` throws.** Two args means set; missing val is a contract violation.

### `the.form(formEl)` — form extraction

Walks `input, select, textarea` descendants. Skips unnamed, disabled, submit/button/reset controls, and unchecked checkboxes/radios. Parses bracket-notation names into a nested object:

```javascript
the.form(form);
// <input name="user[name]" value="Alice">     → { user: { name: "Alice" } }
// <input name="tags[]" value="a">             → { tags: ["a", ...] }
// <input name="tags[]" value="b">
```

Returns a **nested** object (matches browser submission semantics). Compose with `the.flat` before feeding to `the(el, {...})`.

### `the.flat(obj, sep = "_")` — nested-to-flat

```javascript
the.flat({ user: { name: "Alice" }, tags: ["a", "b"] });
// → { user_name: "Alice", tags_0: "a", tags_1: "b" }

the.flat({ a: { b: 1 } }, ".");
// → { "a.b": 1 }
```

Throws on non-object input.

### `the.boot(options?)` — explicit init

Importing the module does **nothing**. Call `the.boot()` at the consumer's entry point.

```javascript
await the.boot({ signal, locales, dictionary, namespace });
```

| Option | Type | Behavior |
| --- | --- | --- |
| `signal` | `AbortSignal` | Aborts the i18n fetch. |
| `locales` | `string` | Override the `<meta name="i18n" content>` path. |
| `dictionary` | `object` | Inline dictionary; skips the fetch entirely. |
| `namespace` | `string` | Sets `localStorage` prefix to `${namespace}:` (default `otm:`). Must be set before any state ops. |

Boot sequence:
1. Resolve locale: `?lang=` query → `localStorage["${prefix}lang"]` → `navigator.language`. Writes `the.locale`.
2. Resolve dictionary: inline `dictionary` → `fetch(${path}/${target}.json)` if `<meta name="i18n">` or `locales` option is present. Falls back through full → base → `data-fallback`.
3. Replay `localStorage` entries matching the prefix (except `${prefix}lang`) back onto body `data-*` and `[data-text]`.
4. Run `_t()` to hydrate `[data-i18n]`.

### `_t(key, options)` — `Intl` localization

```javascript
_t("hello");                                       // string lookup in the.dictionary
_t("hello", { name: "Alice" });                    // {name} → "Alice"
_t("items", { qty: 5 });                           // Intl.PluralRules picks { one, other } entry
_t("price", { val: 9.99, type: "currency" });      // Intl.NumberFormat (USD)
_t("when", { val: Date.now(), type: "date" });     // Intl.DateTimeFormat

_t(node);                                          // hydrate every [data-i18n] inside node
_t();                                              // hydrate document.body
```

Missing dictionary keys preserve existing `textContent` (SEO fallback).

`[data-i18n]` element binding:

```html
<span data-i18n="cart_items" data-i18n-qty="3"></span>
<span data-i18n="price" data-i18n-val="9.99" data-i18n-type="currency"></span>
```

### `route(callback)` — pushState router

```javascript
route((pathname, search, hash) => {
  // render whatever fits this route
});
```

Fires the callback on initial mount, on `popstate`, on `hashchange`, and on intercepted internal `<a>` clicks. Skips interception for `data-external`, `target="_blank"`, and cross-origin hrefs. Hash-only same-page links are left to the browser; `hashchange` still triggers the callback.

### `$(context, selector)` / `$$(context, selector)` — context-aware DOM query

```javascript
$(el, ".child");        // first match (Element | null)
$$(el, ".child");       // all matches (Array)
$(".child");            // shorthand: context = document
$$(".child");
```

### `$.clone(parent, selector)` — template instantiation

```javascript
const el = $.clone("#list", "#tmp");
```

Clones the first element of `<template selector>`, runs `_t(el)` for i18n hydration, appends to `parent`, dispatches a bubbling `mounted` CustomEvent (`detail: { parent }`), and returns the mounted element. Throws if `parent` or template is missing.

## Patterns

### Form intake

```javascript
on("#todo-form", "submit", (e) => {
  e.preventDefault();
  const data = the.form(e.target);                          // { task, tags: [...] }
  the($.clone("#todo-list", "#todo-item"), the.flat(data)); // task, tags_0, tags_1 → attrs
});
```

### List rendering with i18n

```html
<template id="post-card">
  <article data-item>
    <h2 data-text="title"></h2>
    <p data-i18n="posted_at" data-i18n-val=""></p>
  </article>
</template>
<section id="posts"></section>
```

```javascript
for (const post of posts) {
  const el = $.clone("#posts", "#post-card");
  the(el, { title: post.title });
  $(el, '[data-i18n="posted_at"]').setAttribute("data-i18n-val", post.created_at);
}
_t();
```

### Routing (multi-page SPA)

```javascript
route((path) => {
  the("page", path === "/" ? "home" : path.slice(1));
});
```

```css
main > section { display: none; }
[data-page="home"]    main > section[data-route="home"]    { display: block; }
[data-page="about"]   main > section[data-route="about"]   { display: block; }
[data-page="contact"] main > section[data-route="contact"] { display: block; }
```

### Hot dictionary swap

```javascript
on("nav", "click", "[data-lang]", async (_e, link) => {
  const lang = link.getAttribute("data-lang");
  the.locale = lang;
  the.dictionary = await (await fetch(`/locales/${lang}.json`)).json();
  _t();
});
```

### Namespaced state

```javascript
// Two apps on the same origin can coexist:
await the.boot({ namespace: "dashboard" }); // localStorage keys: dashboard:theme, etc.
```

### Cleanup with on() unsubscribe

```javascript
const off = on("#modal", "click", "[data-action='close']", closeModal);
on.emit(document.body, "modal-closed");
off(); // detach when modal is destroyed
```

### Server-side rendering (no extra API)

There's no SSR shim. Emit `data-*` attributes from the server:

```html
<!-- rendered server-side -->
<body data-theme="dark" data-user="Alice">
  <h1 data-text="user">Alice</h1>
</body>
```

On the client:

```javascript
await the.boot();   // localStorage values, if any, override the server-rendered attrs
```

The framework reads existing attributes via `the(key)` without modification, so server-rendered state is observable immediately. `the.boot()` only mutates when localStorage has matching keys.

## Anti-patterns (linter rejects)

| Rule | Forbidden | Use instead |
| --- | --- | --- |
| **JS-001** | `el.innerHTML = "..."` | `$.clone(parent, "#tmpl")` for structure; `the(el, "key", val)` for text. |
| **JS-003** | `el.style.color = "red"` | CSS with attribute selectors: `[data-theme="dark"] h1 { color: red }`. |
| **JS-009** | `el.addEventListener("click", fn)` | `on(parent, "click", selector, fn)`. |
| **JS-011** | `el.setAttribute(name, val)` with dynamic name | Static attribute names only. Use `the()` for state. |
| **JS-015** | `el.textContent = "x"` | `the(el, "key", "x")` writes via `[data-text]`. |
| **JS-016** | `the(el, { nested: { obj: 1 } })` | `the(el, the.flat({ nested: { obj: 1 } }))`. |
| **JS-019** | `on(btn, "click", ...)` for form data | `on(form, "submit", ...)`. |
| **HTML-004** | Naked text in HTML | Wrap in `<p>`/`<span>`/etc. or use `data-i18n="key"`. |
| **HTML-014** | `<button onclick="...">` | `on(parent, "click", "button", fn)`. |
| **HTML-017** | `<div data-action="...">` without `role`/`tabindex` | Use a `<button>`. |
| **HTML-018** | `<input>` without label or `aria-label` | Add `<label>` or `aria-label`. |
| **HTML-020/021/022** | Missing `<html lang>`, `<meta charset>`, `<meta viewport>` | Include all three. |
| **HTML-023** | `data-i18n="..."` without `<meta name="i18n">` | Declare the i18n endpoint. |
| **HTML-024** | `<meta name="i18n" data-available="...">` doesn't match locales folder | Keep the manifest aligned with the actual locale files. |
| **CSS-006** | `color: red !important;` | Refactor specificity. |
| **CSS-012** | `.active { ... }` class selectors | Use attribute selectors: `[data-state="active"] { ... }`. |

Run the linter against your project: `npx otm-lint --check ./src`. It default-excludes `node_modules`, `dist`, `.git`, and dotdirs.

## Suggested project layout

```
my-app/
├── index.html              # Pico + meta tags + script entry
├── app.js                  # await the.boot(); register handlers
├── locales/
│   ├── en.json
│   ├── es.json
│   └── fr.json
├── styles.css              # attribute-selector-driven custom CSS (optional)
└── views/
    ├── home.html           # fragment imported via fetch + $.clone, or inline <template>
    └── about.html
```

`<meta name="i18n" content="/locales" data-available="en,es,fr" data-fallback="en">` directs `the.boot()` to fetch `/locales/{lang}.json` automatically.

## Repository layout (contributors)

```
src/
├── core/
│   ├── index.js           # public exports
│   ├── On.js              # event delegation + emit
│   ├── The.js             # state, i18n, boot, route, form, flat
│   └── Select.js          # $, $$, clone
└── linter/
    ├── main.js            # otm-lint binary entrypoint
    ├── cli.js             # directory scan, output
    └── Linter.js          # rule implementations
test/
└── integration.test.js    # cross-module integration suite
dist/
└── on_the_money.min.js    # built ESM bundle (esbuild)
```

Unit tests are co-located with source: `src/core/On.test.js`, etc.

## Commands

| Script | Purpose |
| --- | --- |
| `npm test` | Run all tests (`node --test`). |
| `npm run test:coverage` | Tests + coverage report (50/50/50 line/branch/function gate). |
| `npm run lint` | Biome formatter + import order. |
| `npm run build` | Build `dist/on_the_money.min.js` via esbuild. |
| `npm run check` | `lint + build + test + coverage`. CI gate. |
| `npm run otm` | Self-lint `examples/` against project rules. |

## License

MIT. Source and issues: <https://github.com/possumtech/on_the_money.js>
