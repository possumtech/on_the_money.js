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
  `[data-text]` owns text projection, and `MutationObserver` is the sanctioned
  imperative fan-in. The framework adds no subscriber system.
- Every rendered text node belongs in an i18n-addressable carrier bearing
  `data-i18n` or `data-text`, with source-language fallback text when practical.
- Attribute state is a public interface. Global and scoped state-key collisions
  are lint failures, and renaming a consumed `data-*` key is a contract change.
- `the(key, null)` deletes state. `undefined` is a contract violation. Global
  writes produce `data-*`; ARIA mapping applies only to element-scoped writes.
- `the.form` mirrors browser submission shape. `[]` names always produce
  arrays, multi-selects include every selected value, files are skipped, and
  prototype-bearing path segments are rejected.
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

The styling contract assumes a classless substrate that styles semantic HTML
without classes, responds to ARIA state, themes through custom properties, and
switches themes through a data attribute. No particular third-party stylesheet
is a dependency, and a first-party base stylesheet is out of scope.

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
