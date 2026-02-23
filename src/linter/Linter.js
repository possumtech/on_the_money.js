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
      if (
        node.type === 'AssignmentExpression' &&
        node.left.type === 'MemberExpression' &&
        node.left.property.name === 'innerHTML'
      ) {
        violations.push({
          file,
          ruleId: 'JS-001',
          line: node.loc.start.line,
          column: node.loc.start.column,
          message: 'Assignment to innerHTML is strictly forbidden.'
        });
      }

      // JS-003: No direct style manipulation
      if (this.#isDirectStyleManipulation(node)) {
        violations.push({
          file,
          ruleId: 'JS-003',
          line: node.loc.start.line,
          column: node.loc.start.column,
          message: 'Direct style manipulation is forbidden. Use the() and CSS instead.'
        });
      }
    });
  }

  static #isDirectStyleManipulation(node) {
    // el.style.color = "..."
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.object.type === 'MemberExpression' &&
      node.left.object.property.name === 'style'
    ) {
      return true;
    }

    // delete el.style.color
    if (
      node.type === 'UnaryExpression' &&
      node.operator === 'delete' &&
      node.argument.type === 'MemberExpression' &&
      node.argument.object.type === 'MemberExpression' &&
      node.argument.object.property.name === 'style'
    ) {
      return true;
    }

    return false;
  }


  static #traverse(node, callback) {
    if (!node) return;
    callback(node);
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => this.#traverse(child, callback));
        } else if (node[key].type) {
          this.#traverse(node[key], callback);
        }
      }
    }
  }
}
