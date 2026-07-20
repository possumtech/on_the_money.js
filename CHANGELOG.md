# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.2] — 2026-07-20

### Changed

- **HTML-106 promoted from warn to error tier.** The production trial closed with zero false positives across both consumers and one true positive (a `the()` write projecting into a slot that doesn't exist — dead state the deletion test exists to catch). Runs that previously reported-and-passed now fail on unconsumed global keys; consume the key or delete the write. The warn-tier machinery remains for future rules. (#136)
- **HTML-107 pairs by CSS reference, not name coupling** (landed post-0.7.1 as #144): the state key revealing a span may be named anything — a reveal rule necessarily references the span it reveals, so the reference is the proof. Kills the false-positive class that condemned functional cross-named wiring. (#143)

## [0.7.1] — 2026-07-19

Port feedback, same day: the first downstream migrations onto the 0.7.0 batteries surfaced three regressions. Issues #132–#135, #137; PRs #138–#142.

### Fixed

- **`otm/no-raw-websocket` flags only the browser global.** Scope-resolved: an imported or locally declared `WebSocket` (a Node `ws`-package client) passes — the hand-rolled-lifecycle slop vector the rule targets doesn't exist there. (#132)
- **`.ejs` joins otm-lint's markup universe** for cross-file rules (reveal spans, slots, actions); per-file rules stay `.html`-only so template syntax never trips HTML-004. HTML-107's css→span direction is silent when zero reveal spans were found anywhere — an empty universe is blindness, not dead wiring. Kills 46 false errors on server-templated projects. (#133)
- **src-first entry — the core singleton unforked.** `exports "."` (and `main`/`module`) resolve to `src/core/index.js`, the same graph every battery subpath imports; previously `.` pointed at the dist bundle, so importing the entry plus any battery loaded two `The` singletons and `boot()` configured one while batteries read the other. The redundant `./src` alias is gone; `dist/` demotes to a CDN/script-tag artifact. Reverses the 0.2.0 dist-entry decision — deliberately, no legacy. (#134)
- Test-runner IPC flake (`Unable to deserialize cloned data`) starved at the source: the CLI's console chatter is mocked in its tests. (#30 lineage)

### Changed

- Blog example modernized to 0.7.0 idioms: `$.cloneEach` + `data-bind` replace the manual clone loop and per-clone `setAttribute`. (#135)

## [0.7.0] — 2026-07-19

The boundary release. OTM's mandate extends to the browser side of live data — batteries for the platform's gaps, contracts instead of server code, and the lint stack grown into a drift wall — under a ratified constitution: a battery ships only if it wraps a platform *absence*, rides an existing standard or published machine-readable convention, lands with lint + doctest on day one, lives in a subpath the core never pays for, and carries an explicit NOT-list. Issues #84, #86–#89, #115–#120; PRs #121–#131.

### Breaking

- **`_t` currency must be explicit.** The hardcoded USD default is gone: `options.currency` / `data-i18n-currency` (ISO 4217), throw without one, platform `RangeError` on invalid codes. New HTML-025 catches the missing declarative code at lint time. Constitutional principle: directive attributes mirror Intl option names verbatim — OTM invents no formatting vocabulary. (#118)
- **New error-tier lint rules** fail runs that previously passed: `otm/no-raw-websocket` (use `live()`), HTML-107 reveal-key parity. (#86, #117)

### Added

- **`on_the_money/live`** — WebSocket battery harvested from four production implementations of the same lifecycle: `live(pathOrState, { onMessage, onDown, onUp, signal })` → `{ send, request }`; jittered backoff with stable-timer reset and guarded dial; `close(1000)` terminal; `req_id` correlation that resolves `null` and never rejects; `takeLatest` supersession; server-advertised channels via body state. Wire conventions ship as `examples/live/asyncapi.yaml` + reference server — contract-as-document, no server code in the package. (#86)
- **`sse()`** — EventSource adapter in the live subpath: named-event subscription, JSON-or-raw-text decode, the same handler contract; reconnection stays the platform's. Streaming-into-slot discipline documented (accumulate + whole-value projection, idempotent under `Last-Event-ID` replay). (#115)
- **`on_the_money/clipboard`** — copy affordances via the capability-declaration pattern: `body[data-clipboard="available"]` reveals server-rendered-hidden `[data-copy]` buttons; `data-copied` pulse for the CSS flash; no dead controls without JS or a secure context. (#116)
- **`data-bind="attr:key"`** — attribute projection, the `[data-text]` sibling: state into `href`/`src`/`datetime`/any plain attribute; `null` removes; HTML-104/106 aware. (#87)
- **`$.cloneEach(parent, selector, items, fill)`** — list rendering with replace-children semantics; deliberately not reactive array-binding; HTML-101 recognizes the shape. (#88)
- **`route(cb, { match })`** — selective enhancement: intercept only opted-in links, everything else navigates natively. (#89)
- **HTML-107** — reveal-key parity wall: `data-K-key="V"` spans ↔ `[data-K="V"]` state-CSS rules, both directions. (#117)

### Fixed

- `otm/prefer-on` states its DOM boundary and names the sanctioned alternatives (handler properties; `live()` for sockets). (#84)
- Test harness `location` stub gained `host`/`protocol`.

### Documentation

- **Substrate contract** replaces the named-stylesheet coupling: four clauses (classless semantic styling, ARIA state response, token custom properties, data-attribute theme switch); vendor a pinned copy as `-vendor.css`. The four-layer CSS architecture (`-vendor`/`-structure`/`-style`/`-state`) is canon, with `-state.css` as the only OTM-aware layer. (#119)
- **The enhancement ladder** (rungs 0–4) with the module-form deletion test; **capability declaration** named as a pattern; **battery admission rule** published. (#119)

## [0.6.0] — 2026-07-19

The alignment release. A full-repo audit (theory, specification, documentation, implementation) surfaced probe-confirmed contradictions between the README's contracts and the runtime; 0.6.0 resolves every one against a ratified doctrine (AGENTS.md §0.6.0) and adds CI enforcement so spec/implementation drift becomes a red build. Issues #91–#102, PRs #103–#114.

### Breaking

- **`the(key, null)` now deletes** — removes the attribute, clears `[data-text]` mirrors, removes the persisted `localStorage` entry for `persistKeys` members. Previously wrote the literal string `"null"`. `undefined` still throws. (#94)
- **ariaMap is element-scoped only.** Global writes always produce `data-*`; `the("hidden", true)` no longer sets `aria-hidden` on `<body>` (which hid the whole app from screen readers). (#94)
- **`the.form`**: `[]` names yield arrays at every cardinality (was string at 1, array at 2+); multi-`<select>` yields all selected values; file inputs skipped. (#95)
- **`route()`** returns an unsubscribe and throws on double-registration while one is active (previously stacked listeners and corrupted history). (#93)
- **HTML-004** reimplemented: rendered text must live inside a `data-i18n` or `data-text` carrier, kept as source-language fallback. `data-text` parents are exempt now; the "wrap in a semantic tag" guidance (which the implementation never honored) is gone. (#96)

### Fixed

- `_t()` element hydration preserves existing `textContent` on missing dictionary keys — as the README always claimed. Interpolation replaces every `{token}` occurrence and is inert to `$`-patterns in values. (#91)
- `the.boot({ dictionary })` loads unconditionally; the locale short-circuit governs only the fetch and hydration pass (the quickstart's dictionary was previously discarded silently). Failed dictionary fetches warn and retry the `data-fallback` file. Locale default unified to `"en"`. (#92)
- Router guards modified clicks (meta/ctrl/shift/alt, non-primary button) and `[download]` links; same-URL clicks no-op. (#93)
- `on()` throws a named contract error when a string parent matches nothing. (#95)
- otm-lint detects `<meta name="i18n">` via parse5 — attribute order no longer silently disables HTML-024/102/103. (#96)
- Latent `Linter.#traverse` bug: parse5 template content was never walked; HTML rules now inspect template subtrees. (#97)

### Added

- `route.go(path)` — programmatic navigation (`pushState` never fires `popstate`; redirects had no sanctioned path). (#93)
- **HTML-104**: global `the()` write keys colliding with `data-text` slots in `<template>` subtrees. (#97)
- **HTML-105**: `data-action` ↔ `on()` selector cross-check, both directions (dead controls, orphan handlers); generic `[data-action]` dispatch waives, `data-otm-dynamic` opts out. (#97)
- **HTML-106** (warn tier — reported, never fails the run): the deletion test as lint — globally written keys nothing consumes. otm-lint now scans `.css`. (#97)
- **`on_the_money/test`** subpath: the `setupDOM` linkedom harness consumers need to test OTM apps; the repo's own suite dogfoods it. `linkedom` is an optional peer. Shipped eslint config exempts `**/*.test.*` from `no-server-dom`/`no-document-query`. (#98)
- **Dogfooding**: `eslint.config.js`/`stylelint.config.js` consume the shipped configs via package self-reference; `npm run lint:examples` wired into the `check` gate. (#99)
- **README doctest harness**: every fenced HTML block linted, the quickstart cross-file-scanned and executed end-to-end, every JS block parsed, every CSS block stylelinted — in CI. (#101)

### Documentation

- README rewritten against the doctrine: lint-clean quickstart that teaches real boot behavior, opt-in persistence stated once and correctly, reactivity reframed as delegated-to-platform, all new contracts documented, Testing-your-app section, fetch-intake + `replaceChildren()` recipes, hot-swap pattern persists the language. Size claims and the (incorrect) PurgeCSS section removed. (#100, #102)

## [0.5.3] — 2026-05-28

### Fixed

- **`the.boot()` locale resolution now prefers `<html lang>` over `navigator.language`.** When a server deliberately renders `<html lang="es">`, that's an explicit signal about the document's language — the server may have already considered the visitor's cookies, URL path, or preferences when choosing it. `navigator.language` was previously winning and overriding the server's render with the browser's passive default, causing OTM to flash server-rendered Spanish text back to English on every navigation. Resolution chain is now: `?lang=` → `localStorage["${prefix}lang"]` → `document.documentElement.lang` → `navigator.language` → `"en"`. (#82)

### Behavior change worth noting

Static SPAs that hardcoded `<html lang="en">` and relied on the framework to detect the visitor's browser language are affected. The framework now treats the `lang` attribute as authoritative. Consumers wanting navigator-driven detection should leave `<html lang>` empty or omit the attribute — then the chain falls through to navigator. This was always the more honest setup; the previous behavior papered over the SPA author's hardcoded `lang` claim.

## [0.5.2] — 2026-05-23

### Documentation

- **Added the "Discipline" section to the README.** Names the framework's three state-response mechanisms explicitly: (1) CSS attribute selectors for state→visual, (2) imperative API calls colocated with state writes for one-off platform side effects, (3) `MutationObserver` for DRY of imperative responses across many call sites. Lists the right-vs-wrong matrix for `MutationObserver` (imperative-only responses: yes; CSS's job: no). Ships the "deletion test" self-check. Documents the element-as-state-carrier pattern (`<dialog open>`, `<details open>`, etc.) where state lives on the element with native CSS hooks. (#80)
- **Reframed the existing "Reacting to state changes" pattern** as "Imperative dispatch from many sites (mechanism #3)" — same example, sharper framing as a case of the three-mechanism vocabulary, with an explicit "before reaching for this pattern, check whether CSS can do the job" warning.
- **ESLint rule messages now reference §The Discipline** so consumers hitting a lint failure can read the architectural why in one place, not just the local rule hint.

### Why

The framework rejects subscriber/signal/effect patterns but the discipline was implicit. LLM pretraining is heavily biased toward those patterns; naming the trap explicitly (with the three-mechanism vocabulary as the alternative) gives consumers and LLM authors a concrete framework to reach for instead. The element-as-state-carrier section is the highest-leverage addition — most consumers don't realize `<dialog open>` is already a state attribute with CSS hooks.

## [0.5.1] — 2026-05-23

### Documentation

- **Clarified the "DOM is the database" mandate.** Reframed to acknowledge that the database claim applies to UI signal state (theme, page, modal-open, form-error) — not to structured data, which lives in JS. The original line implied more than the framework actually does; the examples already show comments stored in a `Map` and posts in an array. Removes an overclaim without losing the soul.

## [0.5.0] — 2026-05-23

### Breaking

- **Persistence is now opt-in.** Default behavior writes attributes only — nothing persists to `localStorage`. Declare `the.boot({ persistKeys: [...] })` to opt specific keys in. Replaces `ephemeralKeys` (the deny-list polarity). Consumers writing theme/locale-flavored apps pass `persistKeys: ["theme", "lang"]`; consumers writing page-render apps pass nothing or just `["lang"]`. The deny-list polarity was wrong for modern apps — the default punished state-as-signal patterns. (#69)
- **Keys auto-convert to kebab-case** for attribute writes and `[data-text]` lookups. `the("chapterHasNav", x)` writes `data-chapter-has-nav`; `the("chapter_has_nav", x)` also normalizes to kebab. Round-trips via the platform's `dataset.chapterHasNav` accessor. CSS selectors and `[data-text="..."]` slot values must use kebab-case to match what JS writes. Single-word and already-kebab keys are unchanged. Single-word ARIA shortcut keys (`expanded`, etc.) still map correctly. (#70)

### Added

- **`the.match(pattern, path?)`** — Express-style `:name` segment extraction. Returns `{name: value}` (URI-decoded) or `null`. Scope: `:name` only — no optional, no regex constraints, no wildcards. (#71)
- **`$.clone(parent, selector, { position })`** — pass `afterbegin` / `beforeend` (default) / `beforebegin` / `afterend` to insert at any position via `insertAdjacentElement`. The `mounted` event fires *after* insertion at the final position. (#72)

### Documentation

- **Production CSS purging** — README adds a "Production CSS purging" section with a PurgeCSS safelist pattern. No preset shipped; documenting the pattern keeps the framework agnostic about which purger consumers use. (#67)
- **Reacting to state changes** — README documents `MutationObserver` against `document.body` as the canonical pattern for state-driven side effects (modal orchestration, focus management). The framework deliberately doesn't broadcast events on every write — the platform's primitive is the right tool. (#68)
- **`_t()` with empty dictionary** — README documents the template-literal workaround for default-locale apps that want interpolation. No `options.template` API added; template literals are the platform's interpolation primitive. (#63)
- **Key naming convention** documented under `the(...)` — kebab-case is the canonical surface.

## [0.4.0] — 2026-05-23

### Breaking

- **Removed `the.attr(el, name, val)`.** It was an aesthetic helper that wrapped `el.setAttribute` for non-state attributes. The platform's `setAttribute` is the right primitive for HTML structure attributes; `the()` is for state. Two distinct concerns, two distinct primitives. No call-site uniformity gain was worth the API duplication and the consumer-confusion cost of "which writes go through OTM?".
- **Reverted ARIA mapping to its closed 5-entry set:** `expanded`, `selected`, `hidden`, `checked`, `disabled`. **Criterion: HTML5 widget/form boolean states only.** No future expansion. The five added in 0.3.4 (`invalid`, `required`, `readonly`, `pressed`, `current`) go through `el.setAttribute("aria-...", val)` like any other HTML attribute. Without a stated criterion the ARIA map would grow forever; with one, the line is clear.
- **Removed `the.title(str)`.** Title isn't state; making it a state-method was special-casing for symmetry's sake. Replaced by extending the global setter to walk the entire document (not just body) when looking for `[data-text="key"]` slots. Put `<title data-text="title">Default</title>` in `<head>` and `the("title", "X")` updates it — same pattern as every other reactive slot, no special-case API.
- **Removed `--conformance` flag from `otm-lint`.** Exit code already encodes violation count; the flag duplicated that signal in output without distinct value.

### Added

- **`data-otm-dynamic` opt-out attribute for HTML-101.** `<template id="X" data-otm-dynamic>` is skipped by the orphan-template check. Use when a template is instantiated via dynamic IDs, aliased `$.clone` calls, or other indirection the regex-based detection misses.

### Documentation

- **README**: ARIA inclusion criterion documented (closed set, no future expansion).
- **README**: lint-rule scope acknowledged honestly — `no-server-dom`, `no-document-query`, and `HTML-101` each have real loopholes; the README now describes them as "discipline aids, not enforcement boundaries."
- **README**: plain attribute writes (`href`, `value`, `rel`) explicitly use `setAttribute` directly; the framework deliberately doesn't wrap them.
- **README**: dynamic `<title>` and other `<head>` slot hydration via the body-rooted `the()` is documented as the canonical pattern.

### Why this release

A self-audit of 0.3.4–0.3.6 surfaced six items that violated the leanness mandate: aesthetic helpers, special-case methods, growing-without-criterion API surfaces, and performative lint rules without honest scope documentation. Each is resolved here in favor of clearer, leaner patterns. See #74.

## [0.3.6] — 2026-05-23

### Added

- **`otm-lint` cross-file checks.** Three new rules that no per-format tool can do:
  - **HTML-101 — orphan templates.** `<template id="X">` declared but never referenced by `$.clone(_, "#X")`. Catches dead-template drift after refactors. (#59.1)
  - **HTML-102 — missing i18n keys.** `data-i18n="K"` references a key not in any locale dictionary loaded via the file's `<meta name="i18n">`. Previously silent-fallback-to-key was a runtime UX bug; now caught at lint time. (#59.3)
  - **HTML-103 — placeholder token mismatch.** `data-i18n-{var}` attr has no matching `{var}` token in the dictionary entry. The token is silently dropped at runtime; the lint surfaces it. (#59.4)
- **`--conformance` flag.** Appends a single machine-grep-able line: `OTM conformance: N violations`. Useful for CI gates and LLM tooling. (#59.5)

### Changed

- **`otm-lint` now walks `.html`, `.js`, and locale `.json` files** (was `.html` only). JS files contribute `$.clone(_, "#id")` references for orphan-template analysis. Locale JSONs load per HTML file's own `<meta name="i18n">` so multi-app scans (e.g. `examples/blog` + `examples/todo` with different locale sets) don't cross-contaminate.

## [0.3.5] — 2026-05-23

### Added

- **`otm/no-server-dom`** — bans imports of `linkedom`, `jsdom`, `cheerio`, `parse5`, `htmlparser2`, `happy-dom`, `node-html-parser`, `parse5-htmlparser2-tree-adapter`, `fast-html-parser`. Catches the "render HTML server-side" instinct at the import line. (#58)
- **`otm/no-document-query`** — bans `document.querySelector`, `getElementById`, `createElement`, `write`, etc. Forces consumers through `$()` / `$$()` / `$.clone()`. Bridge code (MutationObserver targets, etc.) uses `// eslint-disable-next-line otm/no-document-query`. (#58)

### Changed

- **ESLint config now matches `.ts`/`.tsx`/`.mts`/`.cts` files** in addition to `.js` variants. Consumers using Node 25 native TS execution (or any project with `.ts` files) no longer have OTM rules silently skip server-side code. README note: matching syntax still requires a TS-aware parser like `@typescript-eslint/parser`. (#57)
- **All ESLint rule messages now include "Common LLM mistake: ..." hints** — turns rule output into a teaching surface. LLMs read rule messages more reliably than README sections, so corrections plant at the point of failure. (#59.6)

## [0.3.4] — 2026-05-23

### Added

- **`the.title(str)`** — sets `document.title` and returns the `<title>` element. Closes the head-hydration gap; `the()` only walks body, so dynamic page titles previously required `document.title = "..."`. (#60)
- **`the.attr(el, name, val)` / `the.attr(el, { attrs })`** — plain attribute writes for non-`data-*`/non-ARIA attributes (`href`, `value`, `rel`, `for`, etc.). Object form for batch. Lets app code stop calling `el.setAttribute(...)` directly. (#62)
- **Extended ARIA mapping** in `the()`: adds `invalid`, `required`, `readonly`, `pressed`, `current` → `aria-*`. Common form/widget states no longer require `setAttribute` fallback. (#61)

### Changed

- **README preamble** explicitly signals that the file is the authoring context for AI agents. **`package.json` description** ends with "See README.md for the authoring context." Reduces inference cost for LLMs walking package metadata. (#59.7, modified — no satellite `LLMS.md` file)

## [0.3.3] — 2026-05-22

### Added

- **`the.boot({ ephemeralKeys })`** — declares state keys that should not persist to `localStorage`. Writes still update DOM and mirror to `[data-text]`, but skip storage; boot replay also skips them. Targets transient signals like `modal`, `loading`, `toast` that shouldn't survive page navigation. (#55)

### Changed

- **`_t(key, options)`** now Intl-formats `options.val` even when the dictionary has no entry for `key`, provided `options.type` is `"currency"` or `"date"`. Default-locale apps (those using `defaultLocale` to skip the dictionary fetch) can now use `data-i18n-val` formatting without needing a placeholder dictionary entry. Missing entries with no `type` still return the key, as before. (#53)

## [0.3.2] — 2026-05-20

### Added

- **`the.boot({ defaultLocale })`** — when the resolved locale base matches this value, the dictionary fetch and the boot-time `_t()` hydration pass are skipped entirely. No network, no FOUC for default-locale visitors. Auto-detected from `<html lang>` if the option is omitted, so the no-config case Just Works for any page that correctly declares its language. (#52)
- **localStorage state replay** still runs in the short-circuit path; only the i18n machinery is skipped.

### Changed

- **README** now recommends including source-language fallback text inside every `data-i18n` element (e.g. `<h1 data-i18n="title">Welcome</h1>`). Combined with the `defaultLocale` short-circuit, default-locale visitors see correct text immediately with zero hydration pass.

## [0.3.1] — 2026-05-19

### Fixed

- **README lint-stack tables** no longer refer to `eslint-plugin-otm` and `stylelint-plugin-otm` as if they were standalone packages. They ship bundled inside `on_the_money` via subpath exports; the rule-source columns now read "bundled in `on_the_money`". Anyone following the README literally was tempted to `npm install -D eslint-plugin-otm`, which 404s. (#49)

### Changed

- **HTML-004 diagnostic** now hints toward `<dl>/<dt>/<dd>` for label/value patterns. The full message reads: "Naked strings in HTML are forbidden. Use data-i18n or wrap in a semantic tag (for label/value pairs, prefer `<dl>`/`<dt>`/`<dd>`)." Pushes consumers toward the semantically meaningful restructure rather than a cosmetic `<span>` wrap. (#50)

## [0.3.0] — 2026-05-18

### Breaking

- **`otm-lint` reduced to four HTML / cross-file rules.** The bundled linter no longer enforces JS or CSS rules. Twelve rules dropped: JS-001, JS-003, JS-009, JS-011, JS-015, JS-016, JS-019, HTML-014, HTML-018, HTML-020, HTML-021, HTML-022, CSS-006, CSS-012. Their enforcement now lives in `eslint-plugin-otm`, `stylelint-plugin-otm`, the stylelint built-in `declaration-no-important`, and recommended companions like `eslint-plugin-no-unsanitized` and `html-validate`.
- **`otm-lint` only scans `.html` files now.** JS and CSS files are silently ignored by the binary; route them through ESLint and Stylelint.
- **Dropped runtime dependencies** `espree` and `css-tree` from devDependencies; the linter no longer parses JS/CSS.

### Added

- **`eslint-plugin-otm`** with five rules: `prefer-on`, `prefer-the-set`, `flat-state`, `prefer-submit`, `no-style-mutation`. Distributed via `on_the_money/eslint-plugin`.
- **`eslint-config-otm`** shareable flat-config at `on_the_money/eslint-config`.
- **`stylelint-plugin-otm`** with one rule: `prefer-attribute-selector`. Distributed via `on_the_money/stylelint-plugin`.
- **`stylelint-config-otm`** at `on_the_money/stylelint-config` — enables our rule plus stylelint's built-in `declaration-no-important`.

### Changed

- **README** linter section rewritten to describe the three-tool stack (ESLint + Stylelint + otm-lint) instead of a single bundled linter.
- **Linter `flat-state` rule** now catches `the({ nested: ... })` single-arg batch case, which the old `Linter.js` missed.

### Rationale

The old `Linter.js` was an attempt at a one-tool-fits-all frontend linter that reimplemented innerHTML detection, !important banning, and inline-handler banning — all of which existing ecosystem tools do better, with editor LSP integration, inline disables, configurable severity, and SARIF reporters. The reorientation positions `otm-lint` as a small auxiliary tool for the cross-file checks no other ecosystem covers, while the heavy lifting goes to ESLint + Stylelint + html-validate where it already belongs.

## [0.2.0] — 2026-05-18

### Breaking

- **Removed import-time auto-handshake.** Importing `on_the_money` is now side-effect-free. Consumers must call `await the.boot()` at their entry point. The old auto-call performed a network fetch and DOM mutation on import.
- **Removed `the.ready` promise.** Boot is explicit now; await `the.boot()` directly.
- **Removed `the(form)` polymorphic shape.** Form extraction is only via `the.form(formEl)`.
- **`the(string, undefined)` now throws.** Two args means set; missing val is a contract violation. Previously silently coerced to the string `"undefined"`.

### Added

- **`the.boot(options?)`** explicit init. Accepts `{ signal, locales, dictionary, namespace }` for abort, override path, inline dictionary, and configurable localStorage prefix.
- **`the.flat(obj, sep = "_")`** recursive flatten helper. Composes `the.form` output into `the(el, {...})` batch input.
- **`the.dictionary`** and **`the.locale`** as live accessors on the exported `the`. Hot-swap supported.
- **`on()` returns an unsubscribe function.** `const off = on(...); off()` detaches the listener.
- **Boolean coercion in `the()` setter.** `the(el, "checked", true)` writes `"true"`; `false` writes `"false"`. Eliminates the truthy-`"false"`-string footgun.
- **`otm-lint` default-excludes** `node_modules`, `dist`, `.git`, and dotdirs. Consumer projects no longer get drowned in dependency false-positives.

### Changed

- **Framing.** "Anti-Framework" rhetoric dropped. Now self-describes as an opinionated, attribute-driven, standards-oriented modern framework.
- **`the(...)` dispatch** rewritten on a single Element-first-arg disambiguator. Three disjoint first-arg types (Element / string / plain Object) eliminate the prior ambiguity that produced silent mis-dispatch on `the("k", undefined)`.
- **`route()`** resolves `href` via `new URL(link.href, window.location.href)` instead of reading the anchor's `.origin`/`.pathname` IDL properties. Robust under non-browser DOM implementations.
- **Tests co-located** next to source (`src/core/On.test.js`, etc.). Integration suite remains at `test/integration.test.js`.
- **`exports."."`** points at the built `dist/on_the_money.min.js`; raw ESM source available as `./src` subpath.
- **README** rewritten as an LLM authoring context document.

### Fixed

- Coverage thresholds adjusted from 80/80/100 to 50/50/50 (the global engineering baseline) — the 100% function gate was demanding test acrobatics for paths like `route()` that need a full window.
- `the.form` no longer requires `FormData` global; uses `querySelectorAll` over named controls for test environment compatibility.

## [0.1.1] — 2026-03-18

Initial public surface. Auto-handshake, polymorphic `the()` dispatch including `the(form)`, `the.ready` promise.
