# on_the_money.js 💸

An opinionated web project **Anti-Framework** that enforces a deterministic, DOM-first approach using native browser APIs and strict architectural constraints.

## Philosophy

The web development industry is trapped in a cycle of architectural slop, trading performance for "experience" via massive frameworks and proprietary DSLs. **on_the_money.js** breaks this cycle as an Anti-Framework—a surgical collection of standard-aligned wrappers that return the power to the native platform.

We must face a new reality: LLMs and AI agents are becoming the primary consumers of the web. If your site relies on non-semantic "clickable divs" and hidden JSON states, it is opaque to the next generation of the internet. By enforcing a deterministic, DOM-first architecture, we ensure your application is perfectly legible to both humans and machines.

Our built-in linter acts as your architectural mentor, scolding you for inaccessible patterns and imperative shortcuts. We don't just help you build faster; we force you to build better by mandating the "Golden Standard" of accessibility and semantic clarity as the path of least resistance.

Arriving at less than 2KB gzipped, we refuse to reimplement what the browser already does. By utilizing native `Intl` for localization and attribute selectors for logic, we deliver a payload that is faster than a typical framework's router alone. It’s time to stop the slop and reclaim the standards.

## Core Features

- **DOM as Database**: State is reflected in attributes, making it inspectable and persistent.
- **Interactive Integrity**: Built-in A11y enforcement (roles, labels, and semantics).
- **Advanced Localization**: Native `Intl` integration for plurals, currency, and date formatting.
- **Pure Templating**: Standard DOM cloning with zero magic or proprietary DSLs.
- **CSS as UI Engine**: Visual transitions are driven exclusively by attribute selectors.

## API Reference

### `on(parent, event, selector, fn)`
Event delegation and message passing.
- `on(document.body, 'click', '.btn', fn)`
- `on.emit(el, 'custom-event', { detail })`

### `the(...)`
State management and rehydration.
- `the('key', 'value')` – Global state.
- `the(el, { expanded: true })` – Scoped state with ARIA mapping.
- `the.ready` – Promise that resolves when the boot sequence (Handshake) is complete.
- **Reactivity:** `data-text="key"` updates automatically when state changes.

### `_t(key, options)`
Advanced `Intl` localization engine.
- `_t('items', { qty: 5 })` – Localized pluralization.
- **Declarative:** `<span data-i18n="p" data-i18n-val="9.99" data-i18n-type="currency"></span>`

### `$(context, selector)`
Context-aware selector and cloning.
- `$(container, '.item')`
- `$$(container, '.items')` – Returns a real Array.
- `$.clone('#template')` – Instantiate templates.

## Quick Example (Todo App)
```javascript
import { on, the, $, $$ } from 'on_the_money.js';

on('#todo-form', 'submit', (e) => {
  e.preventDefault();
  const task = $('#todo-input').value;
  const item = the($.clone('#todo-item'), { task });
  $('#todo-list').appendChild(item);
});
```

## Linter Rules
The built-in linter enforces 20+ "Anti-Slop" rules, including:
- **JS-015:** No direct `.textContent` manipulation.
- **HTML-017:** No `data-action` on non-interactive elements without ARIA.
- **HTML-023:** Missing `<meta name="i18n">` when localization is used.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [LLM.md](LLM.md) for AI-assisted development reference.
