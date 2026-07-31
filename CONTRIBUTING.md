# Contributing to on_the_money.js

`on_the_money.js` is developed on the authenticated PossumTech Gitea and
published downstream to [GitHub](https://github.com/possumtech/on_the_money.js).
GitHub remains the public source and external issue intake; it is not a
co-equal development forge.

## Before changing code

The framework is contract-first. Read the project doctrine in
[README.md](README.md) and the repository guidance in [AGENTS.md](AGENTS.md).
Open or locate the owning Gitea issue before ordinary implementation work.
External contributors should begin with a
[GitHub issue](https://github.com/possumtech/on_the_money.js/issues) so the
maintainer can establish the corresponding development work.

## Development setup

Requirements:

- Node.js 24 or newer
- npm
- Playwright's Chromium, Firefox, and WebKit browsers

Install and verify:

```bash
npm ci
npx playwright install chromium firefox webkit
npm run check
```

The full check runs formatting and lint, lints the examples with the shipped
consumer configs, builds the CDN artifact, runs Node tests and coverage,
compiles the public type contracts, and exercises browser contracts across all
three engines.

## Change discipline

- Use a Conventional branch name and Conventional Commit subject.
- Reproduce defects through the real failing path and add regression coverage
  before changing behavior.
- Update every contract layer affected by the change: implementation, types,
  lint rules, examples, README authoring context, and tests.
- Keep unit tests beside their subject and composed tests under `test/`.
- Do not add automatic lint fixes. The lint stack reports violations; authors
  make deliberate repairs.
- Do not add server infrastructure or product-domain policy to the browser
  package.

PossumTech contributors push working branches only to Gitea `origin`. Accepted
release state reaches the public GitHub downstream through an explicit
publication operation.

## Security reports

Do not publish exploitable details before a fix is available. Use the contact
path in [SECURITY.md](SECURITY.md) when a report should not begin in the public
GitHub issue tracker.

Contributions are licensed under the [MIT License](LICENSE).
