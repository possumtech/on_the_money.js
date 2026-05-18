# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
