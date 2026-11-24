# on_the_money.js agent guidance

Read `../POSSUMTECH.md` completely before using this repository-specific
guidance. Stop and report the conflict if that workspace contract is
unavailable. The central contract owns identity, forge boundaries, Git
workflow, issue etiquette, signing, and publication authority.

## Project responsibility

`otm_codex` owns the architecture, development, maintenance, documentation,
tests, release integrity, and migration of `on_the_money.js`.

PossumTech Gitea is the development system of record. GitHub is the approved
public downstream source, external issue intake, and release-facing history.
npm is the package registry. Ordinary development branches and pushes go only
to Gitea. Publishing accepted state to GitHub or npm is an explicit release
operation, never an automatic second push.

## Product contract

`on_the_money.js` is an attribute-driven browser anti-framework. Its contract
is the product; runtime code, lint rules, examples, documentation, and doctests
are coordinated realizations of that contract.

- The server renders real documents and the browser enhances them. First-party
  static generation, build-time DOM rendering, hydration simulation, and
  documented out-of-browser template workarounds are permanently out of scope.
- Reactivity is delegated to the platform: CSS owns visual state,
  `[data-text]` owns state-to-text projection, and `MutationObserver` is the
  sanctioned imperative fan-in. The framework adds no subscriber system.
- Localizable interface copy uses `data-i18n`; UI state mirrors use `data-text`,
  with source-language fallback text when practical. Ordinary document content
  needs neither marker nor attribute mirror. Insert literal bodies with native
  `textContent`, comparing the live value before writing to preserve unchanged
  nodes and selection. Rich fragments remain an application-owned sanitization
  boundary; the framework adds no renderer or content store.
- Attribute state is a public interface. State keys are canonical lowercase
  kebab-case (`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`) across HTML, CSS, JS, and
  storage — no silent camelCase/snake_case translation. Global and scoped
  state-key collisions are lint failures (`HTML-104` covers both `<template>`
  and `[data-otm-scope]`), and renaming a consumed `data-*` key is a contract
  change. Scoped `the(el, ...)` projection stops at nested `[data-otm-scope]`
  boundaries (uniformly across SSR and CSR); global `the(...)` remains
  document-wide.
- `the(key, null)` deletes state. `undefined` is a contract violation. Global
  writes produce `data-*`; element-scoped ARIA mapping is the closed 4-key
  widget-state set (`expanded`, `selected`, `checked`, `disabled`). `hidden`
  writes `data-hidden`, never `aria-hidden`.
- `the.form` mirrors browser submission shape. `[]` names always produce
  arrays, multi-selects include every selected value, files are skipped, and
  prototype-bearing path segments are rejected. `the.flat` defaults to `"-"`
  so flattened keys compose directly with `the()`.
- Formatting directives mirror `Intl` option names. Currency is explicit;
  locale never implies one.
- The package root resolves to source. `dist/` is a CDN artifact, not a second
  runtime graph.

## Boundary doctrine

Browser batteries are admitted only when they:

1. wrap a platform absence rather than an existing primitive;
2. derive from a web standard or published machine-readable contract;
3. ship with lint rules and doctest coverage;
4. live in a subpath the core bundle does not pay for; and
5. declare an explicit NOT-list.

Server infrastructure is outside the package mandate. Do not absorb CSRF,
CORS, canonical-host, JSON-LD, session, database, or product-domain policy into
this browser framework merely because multiple consumers implement it.

Do not grow OTM into a UI component library. Patterns already covered by native
HTML primitives (`<dialog>`, `<details name>`, `[popover]`, `<select>`,
`<input type="date">`, `<input type="range">`, `role="switch"`) stay permanently
out. `on_the_money/combobox` is admitted strictly as a DOM-native WAI-ARIA APG
controller over semantic `[role="combobox"]` / `[role="listbox"]` /
`[role="option"]` markup — never add query orchestration, debouncing, caching,
template rendering, virtual scrolling, or JS positioning engines to it.

The styling contract is realized through a 5-layer CSS cascade
(`@layer schema, scheme, structure, style, state;`). OTM ships a first-party,
zero-class, Pico-distilled semantic substrate (`on_the_money/css/schema`) and
20 color schemes (`on_the_money/css/schemes/*`) as CSS subpath exports that the
JS core bundle does not pay for. Any contract-satisfying classless stylesheet
remains swappable. App-authored stylesheets split into `structure.css`,
`style.css`, and `state.css`, enforced by `otm/layer-discipline` in Stylelint.

`otm-build` is feature-complete as a minimal, lossless, optional-`esbuild`
wrapper for small zero-config MPAs. Do not add a dev server, HMR, config file,
plugin API, custom CSS pruner, preprocessors, or asset-pipeline knobs; apps
needing richer build infrastructure use Vite or direct `esbuild`.

## Engineering procedure

- Diagnose a defect through its public contract and reproduce the real failing
  path before changing implementation.
- Repair every affected layer coherently: specification or doctrine,
  implementation, lint enforcement, types, examples, documentation, and
  composed coverage.
- Do not add `--fix`; the lint stack reports contract violations and authors
  repair them.
- Keep unit tests beside their subject. Keep composed integration and doctest
  coverage under `test/`.
- Preserve the src-first singleton graph and the separation between core and
  subpath batteries.
- Treat the README examples as executable authoring context for both humans and
  LLMs.

Run `npm run check` before claiming a repository change is complete. It covers
formatting and lint, examples, build output, Node tests, coverage thresholds,
public type contracts, and Chromium/Firefox/WebKit browser contracts. Report
any prerequisite or platform not exercised.
