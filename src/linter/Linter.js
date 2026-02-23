import * as espree from 'espree';

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
    }

    return violations;
  }

  static #checkJsRules(ast, violations, file) {
    this.#traverse(ast, (node) => {
      // JS-001: No innerHTML
      if (node.type === 'AssignmentExpression' && 
          node.left?.property?.name === 'innerHTML') {
        this.#addViolation(violations, file, node, 'JS-001', 'Assignment to innerHTML is strictly forbidden.');
      }

      // JS-003: No direct style manipulation
      if (this.#isStyle(node)) {
        this.#addViolation(violations, file, node, 'JS-003', 'Direct style manipulation is forbidden. Use the() and CSS instead.');
      }

      // JS-009: No addEventListener
      if (node.type === 'CallExpression' && 
          node.callee?.property?.name === 'addEventListener') {
        this.#addViolation(violations, file, node, 'JS-009', 'Direct addEventListener is forbidden. Use on() for event delegation.');
      }

      // JS-011: No dynamic attribute names
      if (node.type === 'CallExpression' && 
          node.callee?.property?.name === 'setAttribute' && 
          node.arguments?.[0]?.type !== 'Literal') {
        this.#addViolation(violations, file, node, 'JS-011', 'Dynamic attribute names are forbidden. Use static strings only.');
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

  static #addViolation(violations, file, node, ruleId, message) {
    violations.push({
      file,
      ruleId,
      line: node.loc.start.line,
      column: node.loc.start.column,
      message
    });
  }

  static #traverse(node, callback) {
    if (!node || typeof node !== 'object') return;
    callback(node);
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          val.forEach(item => this.#traverse(item, callback));
        } else {
          this.#traverse(val, callback);
        }
      }
    }
  }
}
