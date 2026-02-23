import * as espree from 'espree';
import * as parse5 from 'parse5';
import * as csstree from 'css-tree';

export default class Linter {
  static check(file, source) {
    const ext = file.split('.').pop();
    const violations = [];

    if (ext === 'js') {
      const ast = espree.parse(source, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        loc: true
      });
      this.#checkJsRules(ast, violations, file);
    } else if (ext === 'html') {
      const document = parse5.parse(source, { sourceCodeLocationInfo: true });
      this.#checkHtmlRules(document, violations, file);
    } else if (ext === 'css') {
      const ast = csstree.parse(source, { positions: true });
      this.#checkCssRules(ast, violations, file);
    }

    return violations;
  }

  static #checkJsRules(ast, violations, file) {
    this.#traverseJs(ast, (node) => {
      // JS-001: No innerHTML
      if (node.type === 'AssignmentExpression' && 
          node.left?.property?.name === 'innerHTML') {
        this.#addViolation(violations, file, node.loc.start, 'JS-001', 'Assignment to innerHTML is strictly forbidden.');
      }

      // JS-003: No direct style manipulation
      if (this.#isStyle(node)) {
        this.#addViolation(violations, file, node.loc.start, 'JS-003', 'Direct style manipulation is forbidden. Use the() and CSS instead.');
      }

      // JS-009: No addEventListener
      if (node.type === 'CallExpression' && 
          node.callee?.property?.name === 'addEventListener') {
        this.#addViolation(violations, file, node.loc.start, 'JS-009', 'Direct addEventListener is forbidden. Use on() for event delegation.');
      }

      // JS-011: No dynamic attribute names
      if (node.type === 'CallExpression' && 
          node.callee?.property?.name === 'setAttribute' && 
          node.arguments?.[0]?.type !== 'Literal') {
        this.#addViolation(violations, file, node.loc.start, 'JS-011', 'Dynamic attribute names are forbidden. Use static strings only.');
      }
    });
  }

  static #checkHtmlRules(document, violations, file) {
    this.#traverseHtml(document, (node) => {
      // HTML-014: No inline handlers
      if (node.attrs) {
        node.attrs.forEach(attr => {
          if (attr.name.startsWith('on')) {
            const loc = node.sourceCodeLocation?.attrs?.[attr.name] || node.sourceCodeLocation;
            this.#addViolation(violations, file, loc.startLine ? { line: loc.startLine, column: loc.startCol } : { line: 1, column: 1 }, 'HTML-014', `Inline handler '${attr.name}' is forbidden. Use data-action and JS delegation.`);
          }
        });
      }

      // HTML-004: No naked strings
      if (node.nodeName === '#text') {
        const parentName = node.parentNode?.nodeName;
        if (parentName !== 'script' && parentName !== 'style' && node.value.trim() !== '') {
          const loc = node.sourceCodeLocation || { startLine: 1, startCol: 1 };
          this.#addViolation(violations, file, { line: loc.startLine, column: loc.startCol }, 'HTML-004', 'Naked strings in HTML are forbidden. Use data-i18n.');
        }
      }
    });
  }

  static #checkCssRules(ast, violations, file) {
    csstree.walk(ast, (node) => {
      // CSS-006: No !important
      if (node.type === 'Declaration' && node.important) {
        this.#addViolation(violations, file, { line: node.loc.start.line, column: node.loc.start.column }, 'CSS-006', '!important is forbidden. Refactor CSS specificity instead.');
      }

      // CSS-012: Prefer attribute selectors over classes
      if (node.type === 'ClassSelector') {
        this.#addViolation(violations, file, { line: node.loc.start.line, column: node.loc.start.column }, 'CSS-012', `Class selector '.${node.name}' is forbidden. Use attribute selectors ([aria-*] or [data-*]) for state.`);
      }
    });
  }

  static #isStyle(node) {
    const isAssign = node.type === 'AssignmentExpression' && 
                     node.left?.object?.property?.name === 'style';
    const isDelete = node.type === 'UnaryExpression' && 
                     node.operator === 'delete' && 
                     node.argument?.object?.property?.name === 'style';
    return isAssign || isDelete;
  }

  static #addViolation(violations, file, loc, ruleId, message) {
    violations.push({
      file,
      ruleId,
      line: loc.line,
      column: loc.column,
      message
    });
  }

  static #traverseJs(node, callback) {
    if (!node || typeof node !== 'object') return;
    callback(node);
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          val.forEach(item => this.#traverseJs(item, callback));
        } else {
          this.#traverseJs(val, callback);
        }
      }
    }
  }

  static #traverseHtml(node, callback) {
    if (!node) return;
    callback(node);
    if (node.childNodes) {
      node.childNodes.forEach(child => this.#traverseHtml(child, callback));
    }
  }
}
