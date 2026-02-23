# on_the_money.js - Implementation Plan

## Phase 1: Create Test Infrastructure
- [x] Create `test/` directory structure
- [x] Move `fixtures/` to root
- [x] Configure Node.js test runner for **ESNext / Modules**
- [x] Integrate `linkedom` for unit testing

## Phase 2: Implement Syntax-Tree Based Linter
- [x] Integrate parsing libraries: `espree`, `parse5`, `css-tree`
- [x] Implement core JS, HTML, and CSS rules
- [x] Reach pragmatic coverage thresholds
- [ ] Implement Golden Standard rules:
  - [ ] **HTML-017**: Interactive Identity (role/tabindex for `data-action`)
  - [ ] **HTML-018**: Label Law (labels for inputs)
  - [ ] **JS-019**: Prefer Form Submit

## Phase 3: Implement Core Library
- [x] Create **Three Pillars** structure
- [x] Implement `Select.js` (`$`, `$$`, `clone`)
- [x] Implement `On.js` (`on`, `emit`)
- [x] Implement initial `The.js` (`the`, `_t`, rehydration)
- [ ] Expand `The.js` with **Advanced Intl**:
  - [ ] Pluralization logic (`Intl.PluralRules`)
  - [ ] Formatting logic (`Intl.NumberFormat`, `Intl.DateTimeFormat`)
  - [ ] `data-i18n-*` hydration logic

## Phase 4: Integration & Examples
- [ ] Create `examples/` directory
- [ ] Counter App
- [ ] Todo App (Advanced Intl & Persistence)

## Phase 5: Documentation & Polish
- [x] Update SPEC.md and LLM.md with Golden Standard mandates
- [ ] Finalize API documentation
