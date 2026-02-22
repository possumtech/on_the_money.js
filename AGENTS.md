# on_the_money.js - Simplified Implementation Plan

## Phase 1: Core Client Library (Week 1-2)
### Goal: Build the helper functions that make following the patterns easy
- [ ] Create `src/core/` directory structure
- [ ] Implement `on()` - Event delegation system
  - [ ] Basic event delegation
  - [ ] Optional state update integration
- [ ] Implement `the()` - State management
  - [ ] Global state (body attributes + localStorage)
  - [ ] Scoped state (element attributes)
  - [ ] Template stamping (`the('#template', data)`)
- [ ] Implement `$()` and `$$()` - DOM selectors
  - [ ] `$()` returns first match
  - [ ] `$$()` returns Array of matches
- [ ] Implement `_t()` - Localization
  - [ ] Key-value lookup
  - [ ] Auto-populate `data-i18n` elements
- [ ] Create browser build system
  - [ ] ES module export
  - [ ] UMD/minified version
- [ ] Write basic examples
  - [ ] Todo app example
  - [ ] Theme switcher example

## Phase 2: Simple Pattern-Matching Linter (Week 3)
### Goal: Create a lightweight CLI that catches obvious violations
- [ ] Create `src/linter/` directory
- [ ] Implement file traversal
  - [ ] Recursive directory scanning
  - [ ] File extension filtering (.js, .html, .css)
- [ ] Create simple rule system using regex
  - [ ] Rule 1: Detect `innerHTML` assignments
  - [ ] Rule 2: Detect `style.*` assignments
  - [ ] Rule 3: Detect naked strings in HTML (basic regex)
  - [ ] Rule 4: Detect inline event handlers (`onclick=`)
  - [ ] Rule 5: Detect `!important` in CSS
- [ ] Create CLI interface
  - [ ] `otm-lint --check ./src`
  - [ ] Simple violation reporting
  - [ ] Exit codes for CI
- [ ] Add to package.json scripts
  - [ ] `npm run lint`
  - [ ] `npm run lint:fix` (stretch goal)

## Phase 3: Documentation & Examples (Week 4)
### Goal: Make it easy to adopt
- [ ] Create comprehensive examples
  - [ ] Basic counter app
  - [ ] Todo app with Pico CSS
  - [ ] Multi-language example
- [ ] Write migration guide
  - [ ] From vanilla JS to on_the_money.js
  - [ ] From framework (React/Vue) to on_the_money.js
- [ ] Create video tutorials
  - [ ] 5-minute introduction
  - [ ] Building a real component
- [ ] Update README with practical examples

## Phase 4: Community & Polish (Week 5)
### Goal: Make it production-ready
- [ ] Add error handling and edge cases
- [ ] Performance optimization
- [ ] Browser compatibility testing
- [ ] Create GitHub template repository
- [ ] Set up GitHub Actions for CI
- [ ] Create VS Code snippet collection

## Phase 5: Advanced Features (Future)
### Only after core is stable and adopted
- [ ] ESLint plugin (optional)
- [ ] VS Code extension
- [ ] More sophisticated rules (with proper parsers)
- [ ] Auto-fix capabilities
- [ ] Integration with build tools (Vite, Webpack)

## Immediate Next Steps:
1. Create `src/core/on.js` with basic event delegation
2. Create `src/core/the.js` with state management
3. Create simple test HTML file to verify functionality
4. Build and test in browser

## Design Principles for Simple Linter:
- Use `String.includes()` and regex where possible
- No AST parsing initially
- False positives are acceptable in v1 (better to catch too much)
- Clear error messages with examples
- Fast execution (< 1s for typical project)
