# on_the_money.js - Test-First Implementation Plan

## Phase 1: Create Test Infrastructure (Day 1)
### Goal: Set up testing framework and create failing tests
- [ ] Create `test/` directory structure
  - [ ] `test/core/` - Tests for core library functions
  - [ ] `test/linter/` - Tests for linter rules
  - [ ] `test/fixtures/` - Example files for testing (good/bad patterns)
- [ ] Configure Node.js test runner
- [ ] Create failing tests for all core functions:
  - [ ] `on()` event delegation tests
  - [ ] `the()` state management tests
  - [ ] `$()` and `$$()` selector tests
  - [ ] `_t()` localization tests
- [ ] Create failing tests for linter rules:
  - [ ] OTM-001 (no innerHTML)
  - [ ] OTM-003 (no direct style)
  - [ ] OTM-004 (no naked strings in HTML)
  - [ ] OTM-005 (prefer ARIA over data-*)
  - [ ] OTM-006 (no !important in CSS)
  - [ ] OTM-009 (event delegation pattern)
  - [ ] OTM-011 (no dynamic attribute names)
  - [ ] OTM-012 (attribute selectors in CSS)
  - [ ] OTM-013 (semantic HTML)
  - [ ] OTM-014 (no inline handlers)

## Phase 2: Implement Naive Linter (Day 2-3)
### Goal: Create simple regex-based linter that passes all tests
- [ ] Create `src/linter/` directory
- [ ] Implement simple file traversal
- [ ] Create regex-based rule detection:
  - [ ] JavaScript rules (detect `innerHTML`, `style.*`, etc.)
  - [ ] HTML rules (detect naked strings, inline handlers, style=, etc.)
  - [ ] CSS rules (detect `!important`, `.is-*` classes, etc.)
- [ ] Create CLI interface (`cli.js`):
  - [ ] `--check` option for directory scanning
  - [ ] Simple violation reporting
  - [ ] Exit codes for CI integration
- [ ] Verify linter catches violations in test fixtures
- [ ] Verify linter passes on good examples
- [ ] Use linter to test our own code as we write it

## Phase 3: Implement Core Library (Day 4-5)
### Goal: Implement core functions to pass all tests
- [ ] Create `src/core/` directory
- [ ] Implement `on()` - Event delegation
  - [ ] Basic event delegation
  - [ ] Support for `data-action` pattern
- [ ] Implement `the()` - State management
  - [ ] Global state (body + localStorage)
  - [ ] Scoped state (element attributes)
  - [ ] Template stamping
- [ ] Implement `$()` and `$$()` - DOM selectors
- [ ] Implement `_t()` - Localization
  - [ ] Key-value lookup
  - [ ] Auto-population of `data-i18n` elements
- [ ] Run linter on our own implementation
- [ ] Fix any violations our own code creates

## Phase 4: Integration & Examples (Day 6-7)
### Goal: Create working examples and verify everything works together
- [ ] Create `examples/` directory
  - [ ] Simple counter app
  - [ ] Todo app with Pico Classless CSS
  - [ ] Theme switcher
- [ ] Test examples in browser
- [ ] Use linter to verify examples follow patterns
- [ ] Create basic build system:
  - [ ] ES module export
  - [ ] Browser bundle (minified)
- [ ] Update package.json with build scripts

## Phase 5: Documentation & Polish (Day 8)
### Goal: Update documentation to match working implementation
- [ ] Update README.md with actual working examples
- [ ] Update SPEC.md with lessons learned
- [ ] Create API documentation
- [ ] Create migration guide from vanilla JS
- [ ] Test installation via npm

## Immediate Next Actions:

### 1. Create test directory structure:
```
test/
├── core/
│   ├── on.test.js
│   ├── the.test.js
│   ├── selectors.test.js
│   └── i18n.test.js
├── linter/
│   ├── rules.test.js
│   └── cli.test.js
└── fixtures/
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

### 2. Create failing test for OTM-001:
```javascript
// test/linter/rules.test.js
import { assert } from 'node:assert';
import { test } from 'node:test';
import { checkFile } from '../../src/linter/rules.js';

test('OTM-001: should detect innerHTML assignments', () => {
  const badCode = `el.innerHTML = '<div>bad</div>';`;
  const violations = checkFile('test.js', badCode);
  assert(violations.some(v => v.rule === 'OTM-001'));
});

test('OTM-001: should allow template stamping', () => {
  const goodCode = `const element = the('#template', data);`;
  const violations = checkFile('test.js', goodCode);
  assert(!violations.some(v => v.rule === 'OTM-001'));
});
```

### 3. Create naive linter skeleton:
```javascript
// src/linter/rules.js
export const jsRules = [
  {
    id: 'OTM-001',
    pattern: /\.innerHTML\s*=/,
    message: 'Use the() with templates instead of innerHTML'
  },
  // ... more rules
];

export function checkFile(filename, content) {
  const ext = filename.split('.').pop();
  const rules = ext === 'js' ? jsRules : /* ... */ [];
  const violations = [];
  
  content.split('\n').forEach((line, index) => {
    rules.forEach(rule => {
      if (rule.pattern.test(line)) {
        violations.push({
          file: filename,
          line: index + 1,
          rule: rule.id,
          message: rule.message
        });
      }
    });
  });
  
  return violations;
}
```

## Design Principles:

1. **Tests First**: Always write failing tests before implementation
2. **Linter as Test Suite**: Use the linter to verify our own code quality
3. **Simple Regex**: No complex AST parsing initially
4. **Self-Consistent**: Our implementation must pass our own linter rules
5. **Iterative**: Small, testable steps with frequent verification
