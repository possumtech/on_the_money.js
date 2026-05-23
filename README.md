# on_the_money.js

> _This README is the authoring context for AI agents using `on_the_money`. Read top-to-bottom for a complete picture; everything you need to write an OTM app is here. No satellite docs._

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
  <title data-i18n="app_title">My App</title>
  <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@2/css/pico.classless.min.css">
  <script type="module" src="./app.js"></script>
</head>
<body>
  <main>
    <h1 data-i18n="app_title">My App</h1>
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

Aliases on `the`: `the.t === _t`, `the.route === route`, `the.form(formEl)`, `the.flat(obj, sep?)`, `the.boot(options?)`, `the.title(str)`, `the.attr(el, ...)`. Live accessors: `the.dictionary`, `the.locale`.
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

- **ARIA mapping** (key → attribute): `expanded`, `selected`, `hidden`, `checked`, `disabled`, `invalid`, `required`, `readonly`, `pressed`, `current` → `aria-*`. All other keys → `data-*`. Note: HTML `hidden` and `aria-hidden` are different concepts (layout vs accessibility tree); the mapping here is always to `aria-*`.
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

### `the.title(str)` — set `document.title`

`<title>` lives in `<head>`, outside the body subtree that `the()` walks for `[data-text]` mirroring. Use `the.title(str)` for dynamic page titles instead of `document.title = "..."`.

```javascript
the.title(`${user.name} — Dashboard`);
```

Returns the `<title>` element.

### `the.attr(el, name, val)` / `the.attr(el, { ...attrs })` — plain attribute writes

Writes attributes that aren't `data-*` or ARIA — `href`, `value`, `rel`, `for`, etc. Use this instead of `el.setAttribute(...)` so all DOM writes in app code go through the OTM surface.

```javascript
the.attr($("#post-link"), "href", `/posts/${slug}`);
the.attr($("#prev"), { href: prevUrl, rel: "prev" });
```

Returns `el`. Throws if the second arg is neither a string nor a plain object.

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
await the.boot({ signal, locales, dictionary, namespace, defaultLocale });
```

| Option | Type | Behavior |
| --- | --- | --- |
| `signal` | `AbortSignal` | Aborts the i18n fetch. |
| `locales` | `string` | Override the `<meta name="i18n" content>` path. |
| `dictionary` | `object` | Inline dictionary; skips the fetch entirely. |
| `namespace` | `string` | Sets `localStorage` prefix to `${namespace}:` (default `otm:`). Must be set before any state ops. |
| `defaultLocale` | `string` | Locale your static HTML is already written in. When the resolved locale base matches this, the dictionary fetch and `_t()` hydration pass are skipped entirely — no network, no FOUC. Auto-detected from `<html lang>` if omitted. |
| `ephemeralKeys` | `string[]` | Global state keys that **should not** persist to `localStorage`. Writes to these keys still update the body attribute and any `[data-text]` mirrors, but skip the storage write; the boot replay also skips them. Use for transient signals like `modal`, `loading`, `toast`. Scoped state (`the(el, ...)`) never persists regardless. |

Boot sequence:
1. Resolve locale: `?lang=` query → `localStorage["${prefix}lang"]` → `navigator.language`. Writes `the.locale`.
2. **Short-circuit check.** If resolved locale base matches `defaultLocale` (or `<html lang>` if not provided), skip steps 3 and 5. Static HTML already serves the right text.
3. Resolve dictionary: inline `dictionary` → `fetch(${path}/${target}.json)` if `<meta name="i18n">` or `locales` option is present. Falls back through full → base → `data-fallback`.
4. Replay `localStorage` entries matching the prefix (except `${prefix}lang`) back onto body `data-*` and `[data-text]`.
5. Run `_t()` to hydrate `[data-i18n]`.

**Writing `data-i18n` elements:** always include the source-language text inside as a fallback:

```html
<!-- good — SEO fallback, no-JS fallback, no-flash default -->
<h1 data-i18n="title">Welcome to the app</h1>

<!-- avoid — page is blank until hydration -->
<h1 data-i18n="title"></h1>
```

The framework preserves existing `textContent` when a dictionary key is missing, so source-language text inside `data-i18n` elements stays visible if `_t()` runs against an empty dictionary (the short-circuit case above, or any environment without the i18n fetch).

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

Missing dictionary keys preserve existing `textContent` (SEO fallback). When `options.type` is `"currency"` or `"date"`, `Intl` formatting of `options.val` runs regardless of whether the dictionary has an entry — useful in default-locale apps that skip the fetch.

`[data-i18n]` element binding (always include source-language fallback text inside):

```html
<span data-i18n="cart_items" data-i18n-qty="3">3 items</span>
<span data-i18n="price" data-i18n-val="9.99" data-i18n-type="currency">$9.99</span>
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

## Lint stack

on_the_money ships a three-tool stack. Each layer covers what the others can't.

### 1. JavaScript — ESLint + bundled plugin

The ESLint plugin and config ship inside `on_the_money` itself. No separate `eslint-plugin-otm` package — import via subpath.

```bash
npm install -D eslint eslint-plugin-no-unsanitized
```

```javascript
// eslint.config.js
import otm from "on_the_money/eslint-config";
import nounsanitized from "eslint-plugin-no-unsanitized";

export default [
  ...otm,
  nounsanitized.configs.recommended,
];
```

| Rule | Source | Behavior |
| --- | --- | --- |
| `otm/prefer-on` | bundled in `on_the_money` | Ban `addEventListener`; use `on()`. |
| `otm/prefer-the-set` | bundled in `on_the_money` | Ban `textContent`/`innerText`/`nodeValue` assignment. |
| `otm/flat-state` | bundled in `on_the_money` | Ban nested objects/arrays in `the()` calls. |
| `otm/prefer-submit` | bundled in `on_the_money` | Warn on `on(btn, "click", ...)` for form data. |
| `otm/no-style-mutation` | bundled in `on_the_money` | Ban `el.style.* = ...`. |
| `otm/no-server-dom` | bundled in `on_the_money` | Ban imports of `linkedom`, `jsdom`, `cheerio`, `parse5`, etc. — emit JSON and let the OTM client hydrate. |
| `otm/no-document-query` | bundled in `on_the_money` | Ban `document.querySelector`/`getElementById`/`createElement`/etc.; use `$`/`$$`/`$.clone`. Use `// eslint-disable-next-line otm/no-document-query` for legitimate bridge code (MutationObserver targets, etc.). |
| `no-unsanitized/no-inner-html` | `eslint-plugin-no-unsanitized` | Ban `innerHTML`/`outerHTML`. |
| `no-unsanitized/method` | `eslint-plugin-no-unsanitized` | Ban `document.write`, `insertAdjacentHTML`. |

The recommended config matches `**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}` — your TypeScript files are covered if you bring a TS-aware parser like `@typescript-eslint/parser`. OTM's rules read AST nodes that don't depend on type info, but the parser still has to understand the syntax.

### 2. CSS — Stylelint + bundled plugin

Same pattern: the Stylelint plugin and config ship inside `on_the_money`. No separate `stylelint-plugin-otm` package.

```bash
npm install -D stylelint stylelint-config-standard
```

```javascript
// stylelint.config.js
import otm from "on_the_money/stylelint-config";

export default {
  extends: ["stylelint-config-standard"],
  ...otm,
};
```

| Rule | Source | Behavior |
| --- | --- | --- |
| `otm/prefer-attribute-selector` | bundled in `on_the_money` | Ban `.class` selectors; use `[data-state="..."]`. |
| `declaration-no-important` | stylelint built-in | Ban `!important`. |

### 3. HTML / cross-file — `otm-lint`

```bash
npx otm-lint --check ./src
```

| Rule | Forbidden | Use instead |
| --- | --- | --- |
| **HTML-004** | Naked text in HTML | Wrap in a semantic tag or use `data-i18n="key"`. |
| **HTML-017** | `<div data-action="...">` without `role`/`tabindex` | Use a `<button>` or other interactive element. |
| **HTML-023** | `data-i18n="..."` without `<meta name="i18n">` | Declare the i18n endpoint. |
| **HTML-024** | `data-available="..."` doesn't match locales folder | Keep the manifest aligned with the actual locale files. |

`otm-lint` default-excludes `node_modules`, `dist`, `.git`, and dotdirs. It only scans `.html` — everything else delegates to the layers above.

### Recommended companions (not shipped)

| Concern | Tool |
| --- | --- |
| HTML correctness (lang/charset/viewport, inline handlers, deprecated attrs) | `html-validate` |
| Static a11y | `eslint-plugin-jsx-a11y` (works on plain HTML via parsers) |
| Runtime a11y | `axe-core` via Playwright/Cypress against the rendered page |
| Supply-chain | `npm audit`, `osv-scanner` |

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
