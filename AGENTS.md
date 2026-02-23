# on_the_money.js - Implementation Plan

## Phase 1: Create Test Infrastructure
- [x] Create `test/` directory structure
- [x] Move `fixtures/` to root
- [x] Configure Node.js test runner for **ESNext / Modules**
- [ ] Create failing tests for refined core functions (`on`, `the`, `$`, `$$`, `_t`, `clone`, `emit`)

## Phase 2: Implement Syntax-Tree Based Linter
- [x] Integrate parsing libraries: `espree`, `parse5`, `css-tree`
- [x] Implement **JS-001, JS-003, JS-009, JS-011**
- [x] Implement **HTML-004, HTML-014**
- [x] Implement **CSS-006, CSS-012**
- [x] Implement CLI scanning logic in `src/linter/cli.js`
- [x] Verify linter catches violations in `fixtures/`
- [x] Reach **100% Functions**, **100% Lines**, **90% Branch** coverage

## Phase 3: Implement Core Library
### Goal: Implement core functions using `export default class` structure
- [ ] Create `src/core/On.js` - Standard event delegation
- [ ] Create `src/core/Emit.js` - CustomEvent dispatcher
- [ ] Create `src/core/The.js` - State, ARIA mapping, and `data-text` syncing
- [ ] Create `src/core/Clone.js` - Pure template cloning
- [ ] Create `src/core/Select.js` - Context-aware selectors
- [ ] Create `src/core/Translate.js` - Localization
- [ ] Verify our implementation passes our own linter and reaches 100% coverage

## Phase 4: Integration & Examples
- [ ] Create `examples/` directory
- [ ] Verify persistence across refreshes (scoped and global state)
- [ ] Verify ARIA attributes are correctly used as state

## Phase 5: Documentation & Polish
- [ ] Finalize API documentation in README.md, SPEC.md, and THEORY.md

## Immediate Next Actions:
1. Create `src/core/Emit.js` skeleton
2. Update `src/core/index.js` to include `Emit.js`
3. Update core tests to match new `on` signature and add `emit`
4. Implement refined `Select.js` with `$(context, selector)`
