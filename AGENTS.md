# on_the_money.js - Implementation Plan

## Phase 1: Create Test Infrastructure
### Goal: Set up testing framework and create failing tests
- [ ] Create `test/` directory structure:
  ```
  test/
  ├── core/
  │   ├── on.test.js
  │   ├── the.test.js
  │   ├── selectors.test.js
  │   └── i18n.test.js
  └── linter/
      ├── rules.test.js
      └── cli.test.js
  fixtures/
  ├── good/
  │   ├── event-delegation.js
  │   ├── template-stamping.js
  │   ├── semantic.html
  │   └── attribute-selectors.css
  └── bad/
      ├── inner-html.js
      ├── direct-style.js
      ├── naked-strings.html
      └── important.css
  ```
- [ ] Configure Node.js test runner for **ESNext / Modules**
- [ ] Create failing tests for all core functions (`on`, `the`, `$`, `$$`, `_t`)
- [ ] Create failing tests for linter rules (categorized by JS, HTML, CSS)

## Phase 2: Implement Syntax-Tree Based Linter
### Goal: Create a simple linter using standard parsing libraries
- [ ] Create `src/linter/` directory
- [ ] Integrate parsing libraries:
  - [ ] JS: `espree` (for ESNext)
  - [ ] HTML: `parse5` (for standard-compliant HTML)
  - [ ] CSS: `css-tree` (for detailed AST traversal)
- [ ] Implement rule detection based on AST traversal:
  - [ ] **JS-001**: Detect `innerHTML` assignments
  - [ ] **JS-003**: Detect direct `style` property manipulation
  - [ ] **HTML-004**: Detect naked strings in text nodes
  - [ ] **HTML-014**: Detect `on*` inline handlers
  - [ ] **CSS-006**: Detect `!important`
  - [ ] **CSS-012**: Prefer attribute selectors (ARIA or data-) over classes
- [ ] Create CLI interface (`cli.js`) using a modular class structure
- [ ] Verify linter catches violations in test fixtures

## Phase 3: Implement Core Library
### Goal: Implement core functions using `export default class` structure
- [ ] Create `src/core/` directory
- [ ] Implement `on()` in `On.js` - Event delegation
- [ ] Implement `the()` in `The.js` - State & Persistence
  - [ ] Global state (body + localStorage)
  - [ ] Scoped state (element attributes + localStorage)
  - [ ] Template stamping logic
- [ ] Implement `$(selector)` and `$$()` in `Select.js`
- [ ] Implement `_t()` in `Translate.js` - Localization
  - [ ] Hydrate on load, template stamp, and direct calls
- [ ] Verify our implementation passes our own linter

## Phase 4: Integration & Examples
### Goal: Create working examples and verify everything works together
- [ ] Create `examples/` directory
- [ ] Verify persistence across refreshes (scoped and global state)
- [ ] Verify ARIA attributes are correctly used as state

## Phase 5: Documentation & Polish
### Goal: Update documentation to match final implementation
- [ ] Update README.md and SPEC.md with final API details

## Immediate Next Actions:
1. Update `package.json` for ESNext/Module only and clean up old scripts
2. Set up the `test/` structure
3. Implement the AST-based linter skeleton using `espree`, `parse5`, and `css-tree`
