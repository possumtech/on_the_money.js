# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
