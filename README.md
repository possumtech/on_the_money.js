# on_the_money.js

> _This README is the authoring context for AI agents using `on_the_money`. Read top-to-bottom for a complete picture; everything you need to write an OTM app is here. No satellite docs._

Opinionated, attribute-driven, standards-oriented modern framework for the web. Native browser APIs only. ESNext.

UI signal state — theme, page, modal-open, form-error, the boolean and enum flags that drive visual transitions — lives in DOM attributes; structured data (lists of records, collections, async results) lives in JS like everywhere else. Reactivity is delegated to the platform, not reimplemented: CSS attribute selectors respond to state visually, `[data-text]` projects state into text, and `MutationObserver` fans state into imperative calls — the framework adds no reactive machinery of its own. Events use one delegated listener per `(parent, type)` pair. Routing uses the History API. Localization uses `Intl`. There is no virtual DOM, no JSX, no transpilation step, no proprietary tooling. The framework is a thin layer of conventions over the platform.

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
  <link rel="stylesheet" href="./substrate.css">
  <script type="module" src="./app.js"></script>
</head>
<body>
  <main>
    <h1 data-i18n="app_title">My App</h1>
    <p data-text="greeting">Press the button.</p>
    <button data-action="greet" data-i18n="btn_greet">Greet</button>
  </main>
</body>
</html>
```

```javascript
// app.js
import { on, the } from "on_the_money";

await the.boot();

on("main", "click", '[data-action="greet"]', () => {
  the("greeting", "Hello, Alice!");
});
```

Every text node lives inside a carrier — `data-i18n` for localizable copy, `data-text` for state-projected content — and keeps its source-language text as fallback. This source-only document needs no translation endpoint or dictionary files, including for visitors requesting another language: the rendered English remains available. On boot, keys opted in via `persistKeys` replay from `localStorage` onto body `data-*` and `[data-text]` mirrors; by default nothing persists.

## The substrate stylesheet

The lint stack bans class selectors, so an OTM site rides on a **classless substrate** — a stylesheet satisfying four contract clauses:

1. Styles semantic HTML directly — zero classes required (`<main>`, `<nav>`, `<article>`, `<form>`, `<button>`, `<input>` with `<label>`).
2. Responds to ARIA state attributes (`[aria-invalid]`, `[aria-busy]`, `[disabled]`, `<dialog open>`).
3. Exposes its design tokens as CSS custom properties, so your `-style.css` themes by variable override.
4. Hooks theme switching on a data attribute (`[data-theme="dark"]`), so `the("theme", ...)` switches it.

Vendor a pinned copy as your `-vendor.css` (see [CSS architecture](#css-architecture)) rather than hotlinking a CDN. Any contract-satisfying sheet slots in; goes great with [Pico Classless](https://picocss.com)!

## CSS architecture

Both this framework's conventions and its lint assume a four-layer stylesheet split, one concern per file:

```
styles/
├── app-vendor.css      # your pinned substrate copy — zero app knowledge
├── app-structure.css   # layout scaffolding: grid/flex, gap, landmarks
├── app-style.css       # brand: custom-property overrides of substrate tokens
└── app-state.css       # the ONLY OTM-aware layer: attribute-selector reveals
```

`-state.css` is where `body[data-page="home"]`, reveal-key rules, and every state→visual correspondence live — the layer the deletion test exercises and HTML-106/107 audit. Keeping it separate keeps the state vocabulary greppable and the other three layers portable.

## Exports

```javascript
import { on, the, _t, route, $, $$ } from "on_the_money";
```

Aliases on `the`: `the.t === _t`, `the.route === route`, `the.form(formEl)`, `the.flat(obj, sep?)`, `the.match(pattern, path?)`, `the.boot(options?)`. On `route`: `route.go(path)`. Live accessors on `the`: `the.dictionary`, `the.locale`.

For tests: `import { setupDOM } from "on_the_money/test"` (see [Testing your app](#testing-your-app)).

## API

### `on(parent, event, selector, fn)` — event delegation

| Arg | Type | Notes |
| --- | --- | --- |
| `parent` | `Element \| string \| null` | If string, resolved via `document.querySelector`. If falsy, defaults to `document.body`. |
| `event` | `string` | Any DOM event name (`"click"`, `"submit"`, `"mounted"`, etc.). |
| `selector` | `string` | CSS selector matched via `event.target.closest(selector)`. |
| `fn` | `(event, target) => void` | `target` is the element the selector matched. |

Returns an `() => void` unsubscribe function. All four arguments are required; for a form's own submission, use `on(form, "submit", "form", handler)`. A missing selector or handler fails at registration, and `otm/prefer-on` diagnoses incomplete calls.

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
| `the(key)` | Read body `data-KEY`. | `string \| null` |
| `the(key, val)` | Write body attribute + `[data-text="key"]` mirrors document-wide. Persists to `localStorage` only if `key` is in `persistKeys`. | `document.body` |
| `the(key, null)` | Delete: remove the attribute, clear `[data-text]` mirrors, remove the persisted entry. | `document.body` |
| `the({ k: v, ... })` | Batch global write; `null` values delete. | `document.body` |
| `the(el, key)` | Read scoped attribute on `el` (or aria-mapped equivalent). | `string \| null` |
| `the(el, key, val)` | Write scoped attribute on `el` + descendant `[data-text="key"]`. | `el` |
| `the(el, key, null)` | Delete the scoped attribute, clear descendant mirrors. | `el` |
| `the(el, { k: v, ... })` | Batch scoped write; `null` values delete. | `el` |

- **Key naming.** Keys auto-convert to kebab-case for attribute writes and `[data-text]` lookups. `the("chapterHasNav", x)` writes `data-chapter-has-nav`. snake_case (`chapter_has_nav`) normalizes to kebab too. Single-word keys (`theme`, `user`) pass through unchanged. Round-trips via the platform's `dataset` API: `el.dataset.chapterHasNav` reads the same attribute. CSS selectors and `[data-text="..."]` slot values must use kebab-case to match what JS writes.
- **Persistence is opt-in.** Default behavior writes attributes only — nothing persists to `localStorage`. Declare `the.boot({ persistKeys: ["theme", "lang"] })` to opt specific keys in. The boot replay loads only those keys back. Common persistKeys for an i18n + theme app: `["theme", "lang"]`.
- **Deletion is `null`.** `the(key, null)` removes the attribute, clears every `[data-text="key"]` mirror to empty, and removes the persisted `localStorage` entry if the key is in `persistKeys`. `undefined` still throws — a missing value is a bug, an explicit `null` is a delete.
- **ARIA mapping is element-scoped only** (closed set, key → attribute): `expanded`, `selected`, `hidden`, `checked`, `disabled` → `aria-*` when writing via `the(el, ...)`. **Criterion: HTML5 widget/form boolean states only.** No future expansion. Global writes always produce `data-*` — `the("hidden", true)` writes `data-hidden` on body, never `aria-hidden` (which would hide the whole app from screen readers). Other ARIA attributes (`aria-invalid`, `aria-controls`, etc.) go through `el.setAttribute("aria-...", val)` like any other HTML attribute.
- **Dynamic `<title>` and other `<head>` slots:** global `the(key, val)` writes walk the entire document for `[data-text="key"]` matches, not just body. Put `<title data-text="page-title">Default</title>` in `<head>` and `the("page-title", "X")` updates it.
- **Global and scoped keys share one `[data-text]` namespace.** A global write updates every matching slot in the document — including slots inside cloned components. Never reuse a global key as a scoped slot key inside a `<template>`; `otm-lint` flags this as HTML-104.
- **Attribute projection: `data-bind="attr:key"`.** The attribute-space sibling of `[data-text]` — state projects into plain attributes (`href`, `src`, `datetime`, `value`, `title`) declaratively. Space-separate multiple bindings; keys are kebab-case like every slot key; `the(el, { key: null })` removes the bound attribute.

  ```html
  <template id="profile-card">
    <article data-item>
      <a data-text="name" data-bind="href:profile-url">@someone</a>
      <time data-text="joined" data-bind="datetime:joined-at">recently</time>
    </article>
  </template>
  ```

  ```javascript
  const card = $.clone("#cards", "#profile-card");
  the(card, { name: "@alice", profileUrl: "/@alice", joined: "May 2026", joinedAt: "2026-05-01" });
  ```

- **Truly one-off attributes** still use `el.setAttribute(name, val)` directly, colocated with the write (Discipline #2). `data-bind` is for attributes that carry per-element *state-derived data* (every card's link); `setAttribute` is for structural one-offs. If you're writing the same `setAttribute` line in every clone loop, that's a `data-bind`.
- **Booleans coerce** to `"true"`/`"false"` inside the setter. `the(el, "checked", true)` writes `"true"`.
- **Values MUST be strings, finite numbers, booleans, or `null`.** Numbers and booleans stringify; `null` deletes. Objects, arrays, functions, symbols, bigint, `NaN`, and infinities throw at runtime. Pass nested objects through `the.flat(...)` first.
- **`the(key, undefined)` throws.** Two args means set; missing val is a contract violation.

### `the.form(formEl)` — form extraction

Walks `input, select, textarea` descendants. Skips unnamed, disabled, submit/button/reset controls, file inputs, and unchecked checkboxes/radios. Parses bracket-notation names into a nested object. Unsafe path segments (`__proto__`, `prototype`, `constructor`) throw instead of entering the result graph:

```javascript
the.form(form);
// <input name="user[name]" value="Alice">     → { user: { name: "Alice" } }
// <input name="tags[]" value="a">             → { tags: ["a"] } — [] names are
//                                               arrays at every cardinality
// <select name="colors[]" multiple>            → every selected option's value
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
await the.boot({ signal, locales, dictionary, namespace, locale, defaultLocale, persistKeys });
```

| Option | Type | Behavior |
| --- | --- | --- |
| `signal` | `AbortSignal` | Aborts the i18n fetch. |
| `locales` | `string` | Override the `<meta name="i18n" content>` path. |
| `dictionary` | `object` | Inline dictionary used for DOM and programmatic translation, including in the source language. Skips fetching. |
| `namespace` | `string` | Sets `localStorage` prefix to `${namespace}:` (default `otm:`). Must be set before any state ops. |
| `locale` | `string` | Requested locale. Takes precedence over query, stored, document, and browser values; boot resolves it against available translations and the source document. |
| `defaultLocale` | `string` | Actual source language of the rendered HTML. Defaults to `<html lang>`; an explicit value also sets that document language. Source text is the terminal fallback; no source dictionary is required. |
| `persistKeys` | `string[]` | Global state keys that **should** persist to `localStorage`. Default: empty — nothing persists. Writes still update the body attribute and any `[data-text]` mirrors regardless. Boot replay rehydrates only these keys. Use for stable preferences: `["theme", "lang"]`. Scoped state (`the(el, ...)`) never persists regardless. |

Boot sequence:
1. Select the requested locale: explicit `locale` → `?lang=` → opted-in `localStorage["${prefix}lang"]` → `<html lang>` → `navigator.language` → `"en"`. The server's document language outranks the browser's passive preference. To deliberately select the browser's preference, pass `locale: navigator.language` and keep `<html lang>` set to the actual source language.
2. Load an inline `dictionary` if provided, without fetching. An explicitly supplied dictionary is used for both DOM and programmatic translation, including in the source language.
3. Otherwise, when an endpoint is declared, load the available dictionaries in the requested locale's lookup chain, followed by `data-fallback` (default: the declared source language, or `"en"` when undeclared). Lookup uses canonical Unicode locale tags and progressively removes variant/region subtags, retaining script compatibility: `fr-CA → fr`, `sr-Latn-RS → sr-Latn`. At the source language, load its dictionary only if explicitly listed in `data-available`, then terminate the chain. Otherwise use source text without fetching a source file. A same-language regional dictionary can still override the source when it is a closer match. With no `data-available` manifest, only a non-source fallback file is fetched; list available files to enable regional lookup.
4. A network, HTTP, JSON, or dictionary-shape failure warns with its original cause and continues through the chain to source text. Aborting rejects boot. Invalid inline dictionaries and locale identifiers reject as authoring errors.
5. Set `the.locale` to the effective primary locale. Preserve the requested regional settings when compatible with that language and script (`fr-CA` can use `fr.json`); otherwise use the fallback locale. The requested URL/storage preference is not rewritten.
6. Replay opted-in storage keys (except `lang`), then translate `[data-i18n]` in the document, including the head. Resolve each message through the loaded dictionaries; a miss preserves its original source text. Subsequent boot or `_t()` calls restore that original text on a miss, rather than retaining a previous translation.

English is the convention used by examples and unspecified defaults, not an enforced source language. Declare another source using `<html lang="de">` or `defaultLocale: "de"`; OTM does not require an English dictionary. Declaring the source language prevents a guessed source-file fetch. An explicitly advertised source catalog remains useful for dynamic messages; without a source declaration, boot cannot distinguish it from other dictionaries.

This is a documented lookup profile, not full CLDR best-fit matching or transliteration. Native `Intl.Locale` handles canonicalization and likely scripts; OTM does not bundle linguistic tables. Use hyphenated tags (`fr-CA`, not `fr_CA`). Dictionary filenames retain the spelling in `data-available`, while matching is canonical.

Storage access is opt-in for both reads and writes. With no persisted keys configured (or after `persistKeys: []` clears them), boot and state operations never access `localStorage`. Boot reads only opted-in keys; it does not enumerate unrelated storage. When persistence is explicitly enabled, browser storage failures propagate as their original errors from the operation, including boot, writes, and deletion. A failed persisted write may already have updated the DOM; it must not be treated as a successful save.

**Writing `data-i18n` elements:** always include the source-language text inside as a fallback:

```html
<!-- good — SEO fallback, no-JS fallback, no-flash default -->
<h1 data-i18n="title">Welcome to the app</h1>

<!-- avoid — page is blank until hydration -->
<h1 data-i18n="title"></h1>
```

Partial translations are supported. Missing messages retain the source text already in the document; no duplicate source-language JSON is needed. Translated carriers get `lang` for the supplying dictionary; source fallback retains its original language attributes. The document's `lang` continues to describe the source, so untranslated passages inherit it correctly. Keep carriers' source text in place before their first translation; OTM retains it per element for subsequent language changes, not as a second template graph.

Static fallback text is not an interpolation template: `0 comments` cannot describe a later count of one or two. For changing plural/interpolated messages, provide a real source-language catalog and advertise it in `data-available` (or supply an inline `dictionary`). That catalog may contain only the dynamic messages; duplicating all static source text is unnecessary. The same per-message cascade uses it after partial translations. Source-only pages without dynamic messages still need no endpoint or catalog.

Language and direction are separate HTML concerns. Authors supply `dir="rtl"` for right-to-left documents or passages, and `dir="auto"`/`bdi` for appropriate dynamic text. OTM does not infer layout direction from `lang`. See [W3C directionality guidance](https://www.w3.org/International/questions/qa-html-dir).

### `_t(key, options)` — `Intl` localization

```javascript
_t("hello");                                       // string lookup in the.dictionary
_t("hello", { name: "Alice" });                    // {name} → "Alice"
_t("items", { qty: 5 });                           // Intl.PluralRules picks { one, other } entry
_t("price", { val: 9.99, type: "currency", currency: "EUR" });  // Intl.NumberFormat
_t("when", { val: Date.now(), type: "date" });     // Intl.DateTimeFormat

_t(node);                                          // hydrate every [data-i18n] inside node
_t();                                              // hydrate the document, including the head
```

Missing dictionary keys preserve original source `textContent` during element hydration; the programmatic string form searches the same dictionary chain, then returns the key (it does not search the DOM for a template). Interpolation replaces **every** occurrence of a `{token}`, and `$`-characters in values are inert. When `options.type` is `"currency"` or `"date"`, `Intl` formatting of `options.val` runs regardless of whether the dictionary has an entry — useful in default-locale apps that skip the fetch.

Dictionaries map keys to strings (including intentional empty strings) or plural objects with string values under `zero`, `one`, `two`, `few`, `many`, and `other`; `other` is required. Plural selection uses the supplying dictionary's locale. Number/date interpolation retains compatible regional preferences, but does not apply another language's formatting to a fallback message. `the.dictionary` exposes the primary dictionary; assigning it replaces the whole chain and associates that inline dictionary with `the.locale`. Use `_t()` for lookup through fallbacks.

Plural categories are grammatical categories, not exact quantities: French `one` includes zero, so write `"{qty} commentaire"`, not `"1 commentaire"`. Attribute values are strings; use ISO date text in `data-i18n-val`, not a stringified millisecond timestamp. Supply the value before activating `data-i18n-type="date"`; empty or invalid active date values are lint errors (HTML-027), and invalid dates still fail at runtime.

**Formatting vocabulary is Intl's, verbatim.** Directive attributes mirror Intl option names one-to-one — `data-i18n-currency` → `currency` — and OTM defaults none of them: `type: "currency"` without an explicit currency **throws** (the platform itself refuses to infer currency from locale, and it validates ISO 4217 codes with a `RangeError`). The framework ships Intl plumbing, never a currency choice; HTML-025 catches the missing declarative code at lint time.

`[data-i18n]` element binding (always include source-language fallback text inside):

```html
<span data-i18n="cart_items" data-i18n-qty="3">3 items</span>
<span data-i18n="price" data-i18n-val="9.99" data-i18n-type="currency" data-i18n-currency="USD">$9.99</span>
```

### `route(callback)` — pushState router

```javascript
const off = route((pathname, search, hash) => {
  // render whatever fits this route
});
```

Fires the callback on initial mount, on `popstate`, on `hashchange`, and on intercepted internal `<a>` clicks. Left to the browser: modified clicks (meta/ctrl/shift/alt, non-primary button), `[download]` links, `data-external`, `target="_blank"`, and cross-origin hrefs. Clicking a link to the current URL is a no-op. Hash-only same-page links are left to the browser; `hashchange` still triggers the callback.

Returns an unsubscribe function. One router at a time: calling `route()` while another registration is active throws — unsubscribe the first.

**Selective enhancement:** `route(cb, { match: "[data-route]" })` intercepts only links matching the selector — the opt-in polarity for making specific controls instant (sort toggles, filters) while the rest of the site navigates natively. Non-matching links are untouched; `popstate` and `route.go` behave identically in both modes, so the back button stays correct without any hand-rolled listener.

### `route.go(path)` — programmatic navigation

```javascript
on("#login-form", "submit", "form", async (e) => {
  e.preventDefault();
  await submitLogin(the.form(e.target));
  route.go("/dashboard");
});
```

`pushState` + callback invocation in one call. `pushState` alone never fires `popstate`, so this is the sanctioned path for redirects (post-submit, auth bounce). Throws if no router is active. Navigating to the current URL is a no-op.

### `the.match(pattern, path?)` — pattern matching with named segments

Express-style colon syntax. Extracts named segments from `path` (defaults to `window.location.pathname`). Decodes URI-encoded segments. Returns `{name: value}` on match, `null` on no match.

```javascript
the.match("/@:user/:work/:chapter", "/@alice/great-work/chapter-1");
// → { user: "alice", work: "great-work", chapter: "chapter-1" }

the.match("/about", "/about");
// → {} (matched, no params)

the.match("/:slug", "/about/extra");
// → null (segment count doesn't match)
```

Scope: `:name` segments only. No optional segments, regex constraints, wildcards, or nested patterns. If your routing needs those, bring `path-to-regexp` or similar — `the.match` is the 80%-case helper, not a router framework.

### `$(context, selector)` / `$$(context, selector)` — context-aware DOM query

```javascript
$(el, ".child");        // first match (Element | null)
$$(el, ".child");       // all matches (Array)
$(".child");            // shorthand: context = document
$$(".child");
```

### `$.clone(parent, selector, options?)` — template instantiation

```javascript
const el = $.clone("#list", "#tmp");
const head = $.clone("#list", "#tmp", { position: "afterbegin" });   // prepend
const sib  = $.clone(anchorEl, "#tmp", { position: "beforebegin" }); // insert before anchor
```

Clones the first element of `<template selector>`, runs `_t(el)` for i18n hydration, inserts at `position` (default `beforeend` — append inside `parent`), dispatches a bubbling `mounted` CustomEvent (`detail: { parent }`) **after** insertion so the element is at its final position when the event fires. Returns the mounted element. Throws if `parent`/template is missing.

`position` values mirror [`insertAdjacentElement`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentElement):

| Position | Where |
| --- | --- |
| `beforeend` (default) | Inside `parent`, after its last child. |
| `afterbegin` | Inside `parent`, before its first child. |
| `beforebegin` | As `parent`'s previous sibling. |
| `afterend` | As `parent`'s next sibling. |

For `beforebegin` and `afterend`, the first argument is a sibling reference, not a true parent.

### `$.cloneEach(parent, selector, items, fill?)` — list rendering

```javascript
$.cloneEach("#posts", "#post-card", posts, (el, post) => {
  the(el, { title: post.title, permalink: `/posts/${post.slug}` });
});
```

Clears `parent` (`replaceChildren`), clones the template once per item, calls `fill(el, item, index)`, returns the mounted elements. Replace-children semantics only — append flows (infinite scroll) stay a manual `$.clone` loop. Deliberately **not** reactive array-binding: no keyed diffing, no mutate-array-and-watch; that's framework territory and the wrong side of OTM's line. Composes with `data-bind` so `fill` is usually a single `the(el, {...})` call.

## Batteries

The subpaths below are OTM's batteries — the platform's gaps, pre-disciplined. Admission is constitutional; a battery ships only when it clears all five clauses:

1. It wraps a platform **absence** (the WebSocket lifecycle: yes; fetch itself: never).
2. Its contract is an existing web standard or a published machine-readable convention — no code-only inventions.
3. It lands with its lint rules and doctest coverage on day one.
4. It lives in a subpath the core bundle never pays for.
5. It carries an explicit NOT-list.

## `on_the_money/live` — WebSocket battery

The platform gives WebSocket almost nothing: no reconnection, no backoff, no dispatch, no correlation. `live()` owns exactly that absence and hands your handler the messages — how the data is *handled* stays the Discipline's job.

```javascript
import { live } from "on_the_money/live";

const ch = live("/ws", {
  onMessage(type, data, at) {
    if (type === "status") the("model-offline", data.offline ? "1" : "");
  },
  onDown() { the({ modelOffline: "1", rates: "" }); },  // fail closed
  onUp()   { /* colocated recovery, if any */ },
  signal: controller.signal,                            // teardown
});

ch.send({ type: "ping" });
const reply = await ch.request({ type: "filter", q: "cats" }, { takeLatest: true });
```

| Option | Behavior |
| --- | --- |
| `onMessage(type, data, at)` | Every non-reply frame. Unknown types must be ignorable — the vocabulary is append-only. |
| `onError(error, raw)` | Malformed JSON frame. Without this callback, `live()` warns; either way the connection remains open. |
| `onDown()` / `onUp()` | Link state hooks. Fail closed in `onDown`: a dead socket should surface the degraded truth. |
| `signal` | `AbortSignal`; abort closes the socket and stops reconnecting. |

- **Channel forms.** `live("/ws", opts)` derives `ws(s)://` from the page origin; full URLs pass through. `live({ fromState: "live-channel" }, opts)` reads the server-advertised channel from body state and returns `null` when the page has no live representation — the conditional-mount pattern.
- **Lifecycle owned:** jittered exponential backoff (capped 30 s) that resets only after the link holds stable, guarded dial (a throwing constructor reschedules, never orphans the loop), `close(1000)` is deliberate and terminal.
- **`send(frame)`** is fire-and-forget, dropped while down — best-effort posture.
- **`request(frame, { timeoutMs, takeLatest })`** stamps a client-monotonic `req_id`, resolves the echoed reply, and resolves `null` on down, timeout, or supersession — it never rejects. `takeLatest` makes it a latest-wins lane: stale replies drop, and while disconnected only the newest frame is held for the next open.
- **Wire contract:** server→client frames are `{ type, at, data }` with `{ type: "hello" }` first; the conventions live in `examples/live/asyncapi.yaml` with a reference server beside it — the contract is what agents build servers against.
- **NOT in scope:** auth handshakes, heartbeats, binary frames, offline queueing, presence.

### `sse(path, options)` — Server-Sent Events

The platform's `EventSource` already owns reconnection, `retry:` hints, and `Last-Event-ID` resume — so this adapter is nearly nothing: named-event subscription (`types`, because the platform has no wildcard), JSON-or-raw-text decode, and the same handler contract as `live()`.

```javascript
import { sse } from "on_the_money/live";

let answer = "";
sse("/stream/answer", {
  types: ["token", "done"],
  onMessage(type, chunk) {
    if (type === "done") return the("answering", null);
    answer += chunk;
    the("answer", answer);        // the [data-text="answer"] slot grows in place
  },
  onDown() { the("answering", null); },
  signal: controller.signal,
});
```

**Streaming into a slot:** accumulate in JS, project the whole value through `the()` each chunk. Replace-semantics projection is idempotent, so a platform reconnect replaying from `Last-Event-ID` re-renders correctly instead of duplicating text. Pin scroll with CSS `overflow-anchor`; typing-effect motion belongs in CSS behind `prefers-reduced-motion`. NOT in scope: correlation (SSE is one-way — `request/reply` is `live()`'s job), custom backoff (the server's `retry:` hint governs), `Authorization` headers (cookie auth only; header auth needs fetch-streaming, deferred until a consumer needs it).

## `on_the_money/clipboard` — copy affordances

Clipboard writes are behavior CSS cannot express, and the API exists only in secure contexts. This battery is the **capability-declaration pattern** in 20 lines: render copy buttons hidden, declare the capability as state, let state-CSS reveal them. With JS off or no clipboard API, the buttons never appear — no dead controls.

```html
<button data-copy="npm install on_the_money" data-i18n="copy-cmd">Copy</button>
```

```css
[data-copy] { display: none; }
body[data-clipboard="available"] [data-copy] { display: inline-block; }
[data-copy][data-copied="true"] { outline: 2px solid var(--ok, green); }
```

```javascript
import { clipboard } from "on_the_money/clipboard";

const off = clipboard();   // null when the capability is absent
```

Clicking any `[data-copy]` writes the attribute's value to the clipboard and pulses `data-copied="true"` on the button for two seconds (`{ resetMs }` to tune) — the confirmation flash is CSS's job. **Capability declaration generalizes**: feature-detect once, write one state attribute, and every dependent control is revealed by stylesheet rule instead of JS existence checks scattered per control.

## The Discipline

on_the_money adds no reactivity primitives of its own. No signal, effect, autorun, watch, atom, store, derived state, or subscription. There is also no event broadcast on `the()` writes. Reactivity is **delegated to the platform** — CSS selectors, `[data-text]` projection, `MutationObserver` — not absent, and not yours to reimplement. If you find yourself reaching for a reactive primitive — including importing one from another library — you're solving a problem the framework rejects.

Instead, the framework has **three state-response mechanisms**, each with one job:

### 1. CSS attribute selectors handle state → visual

Default. Anything visual goes through `[data-key="value"]` selectors in your stylesheet.

```css
body[data-modal="session-expired"] #session-expired-modal { display: block }
body[data-page="home"] main > section[data-route="home"] { display: block }
[data-state="loading"] progress { display: inline }
```

```javascript
the("modal", "session-expired");   // CSS rule above runs the visual change
```

No JS step between the `the()` write and the visual update. The CSS rule **is** the correspondence. This is the framework's reason for existing — DOM-as-state-database is valuable specifically because CSS can read that database without JS.

### 2. Imperative API calls colocated with state writes

For one-off platform side effects (`dialog.showModal()`, `el.focus()`, `el.scrollIntoView()`, media `.play()`, animation triggers), the imperative call lives in the same `on()` handler that wrote the state.

```javascript
on(document.body, "click", '[data-action="open-modal"]', () => {
  the("modal", "session-expired");
  $("#session-expired-modal").showModal();
});
```

Cause (user click) and imperative effect (`showModal()`) are colocated. The `the()` write records the state; the platform call performs the imperative action. No subscriber between them.

### 3. `MutationObserver` for DRY of imperative responses across many call sites

When the same state can be written from multiple places (user click, fetch handler, boot replay, postMessage) and they all need the same imperative response, observe the attribute once:

```javascript
new MutationObserver(() => {
  const want = the("modal") ?? "";
  for (const open of $$("dialog[open]")) {
    if (open.id !== `${want}-modal`) open.close();
  }
  if (want) $(`#${want}-modal`)?.showModal();
}).observe(document.body, { attributes: true, attributeFilter: ["data-modal"] });
```

The observer doesn't enable reactivity — it deduplicates the imperative response. Any place in the codebase that writes `data-modal` gets the same dispatch logic without copy-pasting.

### When `MutationObserver` is right vs wrong

| Right (the platform call does work CSS can't reach) | Wrong (CSS's job) |
| --- | --- |
| `el.focus()`, `el.blur()` — moving keyboard focus | Showing/hiding via `display: none` |
| `el.scrollIntoView()`, `window.scrollTo(...)` — viewport movement | Changing color, layout, transform |
| `media.play()`, `media.pause()` — playback state | Adding/removing a class |
| `el.animate(...)` — Web Animations timing | Conditional opacity / visibility |
| `el.requestFullscreen()` — browser mode | Animation triggers expressible as CSS transitions |
| `navigator.clipboard.writeText(...)` — out-of-DOM side effects | Toggling text content (use `[data-text]`) |

`dialog.showModal()` is a borderline case: it shows the dialog (visual) AND traps focus, paints the backdrop, registers an Escape handler, and announces modal semantics to assistive tech (behavioral + a11y). If you want only the visual, `dialog[open]` + CSS suffices. If you want the bundled behavior, call `showModal()` — and reach for `MutationObserver` only if `data-modal` can be set from multiple call sites that all need the same dispatch.

If your `MutationObserver` callback is setting styles, toggling classes, or changing `textContent`, you've smuggled a JS reactivity layer into a project that explicitly rejected one. The CSS attribute selector was already doing that job — declaratively, with zero JS, with the right perf shape.

### The deletion test

The single best self-check: strip every JS function except `on()` handlers, the imperative calls inside them, and any `MutationObserver` that handles a many-sites imperative response. Open the page; mutate `body` `data-*` attributes in DevTools.

- Does the page respond correctly? You're idiomatic.
- Does it not? You're missing either a CSS rule (most likely) or an imperative call at a state-write site (occasionally).

### The enhancement ladder

Classify every JS module by why a page refresh cannot replace it — the rung justifies the module's existence:

0. **Structure and content** — the server's job. Never JS.
1. **State → visual** — CSS's job (mechanism #1). No JS beyond the `the()` write.
2. **Server-initiated updates** — a refresh cannot know to happen (a payment confirmed, a comment arrived). The one category that is JS territory by definition: `live()`/`sse()` intake writing state.
3. **Capability-gated affordances** — behavior the platform may not offer (clipboard, share, fullscreen). Feature-detect once, declare the capability as state, reveal dependent controls by CSS.
4. **Latency elimination** — making instant what navigation already does (reactive filters via `route(cb, { match })` + `request()`). The page must stay whole without it.

Every module above rung 1 must pass the deletion test's module form: **delete the file and the site is whole.** If deleting a module breaks content or structure, it was squatting on a rung that belongs to the server or to CSS.

### Element-as-state-carrier

Many platform elements already carry state in their own attributes, with native CSS hooks. When the state genuinely lives on a specific element, use that — don't add a `body[data-x]` indirection:

| Element | Native state attribute | What you do |
| --- | --- | --- |
| `<dialog>` | `[open]` | `el.setAttribute("open", "")` + the substrate's `dialog[open]` CSS, or `el.showModal()` if you need the backdrop and focus trap |
| `<details>` | `[open]` | Same shape; browser handles the disclosure UX |
| `<input>`, `<textarea>` | `[aria-invalid]`, `[aria-required]`, `[disabled]` | Direct `setAttribute`; CSS targets `:invalid`, `[disabled]` |
| `<button>` | `[aria-pressed]` (toggle state), `[disabled]` | Native focus/style for free |
| `<select>` | The current `value` | Read via `el.value`; no body indirection needed |

The `body[data-modal]` indirection is correct when the state is a named enum the consumer controls (which modal is open, current page, theme). When the state genuinely lives on an element (is THIS dialog open?), let it live there.

### Non-DOM EventTargets

`on()` is DOM delegation — `closest(selector)` against a container. A `Worker`, `AbortSignal`, or `MediaQueryList` has no selector to delegate against, and `otm/prefer-on` still flags `addEventListener` on them, deliberately: the sanctioned shape there is different. Use **handler properties** for the single-handler case these targets almost always are:

```javascript
const dark = matchMedia("(prefers-color-scheme: dark)");
dark.onchange = (e) => the("scheme", e.matches ? "dark" : "light");
```

Sockets are their own case: `otm/no-raw-websocket` bans `new WebSocket` outright — use [`live()`](#on_the_moneylive--websocket-battery). Needing multiple listeners or `{ once }` on a non-DOM target is rare enough to warrant `// eslint-disable-next-line otm/prefer-on` with a justification comment.

### Banned vocabulary, in spirit

If you're searching online for "how to subscribe to OTM state changes" or "OTM reactive system" — you're looking for something the framework doesn't have and won't add. The three mechanisms above are the whole story. Reactivity-by-CSS, imperative-by-handler, DRY-by-observer.

## Patterns

### Form intake

```javascript
on("#todo-form", "submit", "form", (e) => {
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
  const date = $(el, '[data-i18n="posted_at"]');
  date.setAttribute("data-i18n-val", new Date(post.created_at).toISOString());
  date.setAttribute("data-i18n-type", "date");
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
await the.boot({ persistKeys: ["theme", "lang"] });

on("nav", "click", "[data-lang]", async (_e, link) => {
  const lang = link.getAttribute("data-lang");
  the("lang", lang);        // persists — boot's resolution chain finds it on reload
  await the.boot({ locale: lang }); // uses the declared dictionary chain and source fallback
});
```

The `the("lang", lang)` write is what makes the preference survive reload: boot reads opted-in `localStorage["otm:lang"]` ahead of `<html lang>`. Without it, the selection reverts on refresh. Declare the translation endpoint and available dictionaries on the document; a source-only document simply retains its source text.

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

### Fetch intake — server emits JSON, client renders

```javascript
const res = await fetch("/api/posts");
const posts = await res.json();

$.cloneEach("#posts", "#post-card", posts, (el, post) => {
  the(el, { title: post.title });
});
```

`$.cloneEach` clears the container for you; when clearing manually, `replaceChildren()` is the sanctioned idiom — `innerHTML = ""` and `textContent = ""` are both banned by the lint stack. Keep server output to data; `otm/no-server-dom` bans rendering HTML server-side.

### Routing with `the.match`

```javascript
route(() => {
  const post = the.match("/posts/:slug");
  if (post) return renderPost(post.slug);

  const profile = the.match("/@:user");
  if (profile) return renderProfile(profile.user);

  if (location.pathname === "/") return renderHome();
});
```

### Imperative dispatch from many sites (mechanism #3)

This is the case-3 pattern from [The Discipline](#the-discipline): the same state can be written from several places (user click, fetch error handler, boot replay, etc.) and all of them need the same imperative response. Observe the attribute once, dispatch from there:

```javascript
new MutationObserver(() => {
  const wantModal = the("modal");
  for (const dialog of $$("dialog[open]")) {
    if (dialog.id !== `${wantModal}-modal`) dialog.close();
  }
  if (wantModal) $(`#${wantModal}-modal`)?.showModal();
}).observe(document.body, { attributes: true, attributeFilter: ["data-modal"] });
```

`document.body` is the allowed identifier under `otm/no-document-query`. Filter by `attributeFilter` to scope the observer narrowly.

**Before reaching for this pattern, check whether CSS can do the job.** If the response is purely visual (show/hide, color, layout), the CSS attribute selector is the right tool and the observer is overhead. Reserve `MutationObserver` for imperative APIs CSS can't express (`showModal`, `focus`, `scrollIntoView`, media controls, animation triggers).

### Dynamic messages in the source language

Programmatic `_t(key, options)` returns the key when no loaded catalog supplies it; static DOM text is not a programmatic message template. Advertise a source-language catalog in `data-available`, or supply an inline dictionary when the application owns that catalog directly:

```javascript
await the.boot({ locale: "en", dictionary: { greeting: "Hello, {name}!" } });
const greeting = _t("greeting", { name: "Alice" }); // "Hello, Alice!"
```

Use `_t()` to search the complete dictionary cascade; `the.dictionary` exposes only the primary catalog, so checking it at call sites bypasses fallback messages.

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

The framework reads existing attributes via `the(key)` without modification, so server-rendered state is observable immediately. `the.boot()` only mutates keys opted into `persistKeys` that have stored values. Fallback text inside `data-text` carriers (`<h1 data-text="user">Alice</h1>`) is the sanctioned shape — HTML-004 requires it.

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
| `otm/prefer-on` | bundled in `on_the_money` | Ban `addEventListener`; require `on(parent, event, selector, handler)`. |
| `otm/prefer-the-set` | bundled in `on_the_money` | Ban `textContent`/`innerText`/`nodeValue` assignment. |
| `otm/flat-state` | bundled in `on_the_money` | Ban nested objects/arrays in `the()` calls. |
| `otm/prefer-submit` | bundled in `on_the_money` | Warn on `on(btn, "click", ...)` for form data. |
| `otm/no-style-mutation` | bundled in `on_the_money` | Ban `el.style.* = ...`. |
| `otm/no-server-dom` | bundled in `on_the_money` | Ban imports of `linkedom`, `jsdom`, `cheerio`, `parse5`, etc. — emit JSON and let the OTM client hydrate. |
| `otm/no-document-query` | bundled in `on_the_money` | Ban `document.querySelector`/`getElementById`/`createElement`/etc.; use `$`/`$$`/`$.clone`. Use `// eslint-disable-next-line otm/no-document-query` for legitimate bridge code (MutationObserver targets, etc.). |
| `no-unsanitized/no-inner-html` | `eslint-plugin-no-unsanitized` | Ban `innerHTML`/`outerHTML`. |
| `no-unsanitized/method` | `eslint-plugin-no-unsanitized` | Ban `document.write`, `insertAdjacentHTML`. |

The recommended config matches `**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}` — your TypeScript files are covered if you bring a TS-aware parser like `@typescript-eslint/parser`. OTM's rules read AST nodes that don't depend on type info, but the parser still has to understand the syntax. Test files (`**/*.test.*`) are exempt from `no-server-dom` and `no-document-query` — tests drive the DOM directly through the `on_the_money/test` harness.

### 2. CSS — Stylelint + bundled plugin

Same pattern: the Stylelint plugin and config ship inside `on_the_money`. No separate `stylelint-plugin-otm` package.

Stylelint's file-glob dependencies currently reach `braces@3.0.3`, affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). This repository uses an exact npm alias override to the reviewed [depth-guard fork](https://github.com/dieub/braces-depth-guard/tree/305a2e4bfe324bb53c336c1b03387ee1251c926f), with artifact integrity recorded in `package-lock.json`:

```json
{
  "overrides": {
    "braces": "npm:@dieub/braces-depth-guard@3.0.3-pn.3"
  }
}
```

**Consumers using Stylelint must add this override to their own root `package.json` and commit their regenerated lockfile.** npm does not inherit overrides from installed libraries. This is not needed for the browser runtime, which contains no Stylelint or `braces`. The override preserves the Stylelint integration; it does not bundle a linter into the browser or modify another project's dependencies.

The reviewed fork caps parsing and AST nesting at 100 levels and rejects excessive input with a specific error instead of overflowing the stack. The original MIT license and public entry point are preserved; the published artifact matches the linked commit. Our tests exercise the actual installed Stylelint glob path, ordinary file globs, and the distinction between CSS content and file patterns. This is a scoped repair, not a guarantee against every resource-exhaustion pattern; a renamed package's clean audit is not proof of a fix. Re-review the exact artifact, provenance, compatibility, and security regression tests before changing this pin. Remove it only after the upstream chain provides a verified replacement.

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
| **HTML-004** | Naked text in HTML | Every rendered text node lives inside a carrier — `data-i18n="key"` for localizable copy, `data-text="key"` for state-projected content — and SHOULD keep source-language fallback text in place. |
| **HTML-017** | `<div data-action="...">` without `role`/`tabindex` | Use a `<button>` or other interactive element. |
| **HTML-023** | A declared `<meta name="i18n">` has no dictionary path | Provide `content`, or omit the meta entirely for a source-only document. |
| **HTML-024** | `data-available="..."` doesn't match locales folder | Keep the manifest aligned with the actual locale files. |
| **HTML-025** | `data-i18n-type="currency"` without `data-i18n-currency` | `_t()` throws at runtime without an explicit ISO 4217 code — declare it on the element. |
| **HTML-026** | Invalid source, available, or fallback locale identifier | Use Unicode locale tags accepted by `Intl.Locale`, such as `fr-CA` or `sr-Latn`. |
| **HTML-027** | Active date formatting has a missing or invalid value | Supply ISO date text in `data-i18n-val` before activating `data-i18n-type="date"`. |
| **HTML-101** | `<template id="X">` is never referenced by `$.clone(_, "#X")` or `$.cloneEach(_, "#X", ...)` | Either delete the orphan template or add the missing clone call. Catches dead-template drift after refactors. Detection is regex-based and matches the literal call shapes — dynamic IDs (`` `#${id}` ``), aliased calls, or templates instantiated through indirection are missed. Use `data-otm-dynamic` on the `<template>` to opt out. |
| **HTML-102** | A key has neither source text nor an entry in any declared dictionary | Supply source fallback text, add the translation, or correct the key. Partial dictionaries are valid. |
| **HTML-103** | `data-i18n-{var}` attr has no matching `{var}` placeholder in the dictionary template | The token is silently dropped at runtime. Either remove the unused attr or add `{var}` to the template. |
| **HTML-104** | A global `the("key", ...)` write collides with a `data-text="key"` slot inside a `<template>` | Global writes walk the whole document and clobber every cloned instance. Rename the template slot key or the global key. |
| **HTML-105** | `data-action` values and `on()` `[data-action="..."]` selector literals disagree | Both directions: a `data-action` no handler references is a dead control; a selector no element carries is an orphan handler. A generic `[data-action]` dispatch selector in JS waives the dead-control direction; `data-otm-dynamic` opts an element out. |
| **HTML-106** | A globally written state key nothing consumes | The deletion test as lint: no CSS attribute selector, `[data-text]` slot, `"data-key"` JS string literal (e.g. MutationObserver `attributeFilter`), or `the("key")` read touches it — dead state or a missing CSS rule. Promoted from warn to error after a zero-false-positive production trial. |
| **HTML-107** | A `data-K-key="V"` reveal span no state-CSS rule references, or a CSS `[data-K-key="V"]` reference no element carries | Pairing is by CSS reference — the state key revealing a span may be named anything (`body[data-form-error="V"] [data-error-key="V"]` is fine). Either half missing means the message silently never shows (or the rule is dead wiring); `data-otm-dynamic` opts a span out of the span→CSS direction. |

`otm-lint` walks `.html`, `.ejs` (cross-file rules only — per-file rules stay `.html`), `.js`, `.css`, and locale `.json` files. HTML files get the per-file rules above (template content included); `.js` files contribute `$.clone` references, `the()` write/read keys, and `data-action` selectors; `.css` files contribute attribute-selector consumption for HTML-106; locale dicts get loaded per HTML file's `<meta name="i18n">` for HTML-102/103. Default excludes: `node_modules`, `dist`, `.git`, dotdirs. Exit code is nonzero when error-level violations are found.

Declared dictionary directories and files must be readable, valid JSON, and valid dictionary objects; failures are errors, not skipped validation. Relative endpoints resolve beside the HTML file. Root-relative endpoints resolve beneath the scanned directory by default; use `npx otm-lint --check ./src --public-root ./public` when `/locales` is served from `public/locales`. Remote endpoints cannot be validated by this filesystem scan. No translation declaration means no dictionary files are required.

### Lint-rule scope

These rules are **discipline aids, not enforcement boundaries.** Each catches the obvious shape; determined consumers can route around them:

- `otm/no-server-dom` matches static `import` only. Dynamic `await import("linkedom")` and CJS `require()` are not caught.
- `otm/no-document-query` catches `document.querySelector(...)` and friends at AST level. Chained calls (`document.body.querySelector(...)`, `document.getElementById("x").querySelector(...)`) are not caught — the call site has moved off `document`.
- `HTML-101` regex-matches `$.clone(parent, "#id")` in `.js` files. Dynamic IDs and aliased calls are missed; use `data-otm-dynamic` to opt out of the check for templates instantiated indirectly.

The rules' job is to catch the *first* mistake and surface a teaching message ("Common LLM mistake: ..."). Strong patterns + good editor feedback do the rest.

### Recommended companions (not shipped)

| Concern | Tool |
| --- | --- |
| HTML correctness (lang/charset/viewport, inline handlers, deprecated attrs) | `html-validate` |
| Static a11y | `eslint-plugin-jsx-a11y` (works on plain HTML via parsers) |
| Runtime a11y | `axe-core` via Playwright/Cypress against the rendered page |
| Supply-chain | `npm audit`, `osv-scanner` |

## Testing your app

`on_the_money/test` ships the same harness this repo's own suite runs on: a [linkedom](https://github.com/WebReflection/linkedom) DOM with every global an OTM app touches installed on `globalThis` — `document`, `window` (with `location`/`history` stubs the router drives), `navigator`, `localStorage`, and the DOM constructors. Install `linkedom` as a dev dependency (it's an optional peer).

```javascript
// app.test.js
import assert from "node:assert";
import test from "node:test";
import { setupDOM } from "on_the_money/test";
import { the } from "on_the_money";

test("theme write projects into the badge", (_t) => {
  const { document } = setupDOM('<span data-text="theme"></span>');
  the("theme", "dark");
  assert.strictEqual(document.querySelector("span").textContent, "dark");
});
```

`setupDOM(bodyHtml, { url, language })` returns the linkedom result — destructure `document`, `window`, or the constructors as needed. Each call installs a fresh DOM and empty `localStorage`, so tests stay isolated. Stub `globalThis.fetch` per test when boot needs a dictionary.

## Suggested project layout

```
my-app/
├── index.html              # substrate link + meta tags + script entry
├── app.js                  # await the.boot(); register handlers
├── locales/
│   ├── es.json
│   └── fr.json
├── styles.css              # attribute-selector-driven custom CSS (optional)
└── views/
    ├── home.html           # fragment imported via fetch + $.clone, or inline <template>
    └── about.html
```

For an English-source document, `<meta name="i18n" content="/locales" data-available="es,fr">` advertises optional Spanish and French dictionaries. English fallback is already in the HTML. Omit both the meta and the `locales/` directory when no translations exist.

## Repository layout (contributors)

`npm run size` measures the minified and gzipped core and lists its module inputs without writing build output. Translation dictionaries are application resources, not part of that bundle.

```
src/
├── core/
│   ├── index.js           # public exports
│   ├── On.js              # event delegation + emit
│   ├── The.js             # state, i18n, boot, route, form, flat
│   └── Select.js          # $, $$, clone
├── test/
│   └── index.js           # setupDOM harness (on_the_money/test)
├── eslint/
│   ├── plugin.js          # eslint-plugin-otm rules
│   └── config.js          # shareable flat config
├── stylelint/
│   ├── plugin.js          # prefer-attribute-selector
│   └── config.js          # shareable config
└── linter/
    ├── main.js            # otm-lint binary entrypoint
    ├── cli.js             # directory scan, output
    └── Linter.js          # rule implementations
test/
└── integration.test.js    # cross-module integration suite
dist/
└── on_the_money.min.js    # CDN/script-tag artifact only — npm resolves "." to src
```

**One module graph.** The npm entry (`.`) and every battery subpath resolve into the same `src/` graph, so `The`'s statics (`dictionary`, `locale`, `prefix`, `persistKeys`) are one singleton everywhere. `dist/on_the_money.min.js` exists solely for `<script type="module">` hotlinking — importing it *alongside* npm subpaths would fork the core, which is exactly the bug this arrangement removes.

Unit tests are co-located with source: `src/core/On.test.js`, etc.

## Commands

| Script | Purpose |
| --- | --- |
| `npm test` | Run all tests (`node --test`). |
| `npm run test:coverage` | Tests + coverage report (50/50/50 line/branch/function gate). |
| `npm run lint` | Biome formatter + import order. |
| `npm run lint:examples` | Dogfood the shipped eslint/stylelint configs against `examples/`. |
| `npm run test:package` | Install the packed package in fresh runtime-only and Stylelint-with-override consumers; verify public imports, lint behavior, the nesting guard, and each full dependency audit. Requires registry access. |
| `npm run build` | Build `dist/on_the_money.min.js` via esbuild. |
| `npm run check` | `lint + build + test + coverage`. CI gate. |
| `npm run otm` | Self-lint `examples/` against project rules. |

## License

MIT. Source and issues: <https://github.com/possumtech/on_the_money.js>
