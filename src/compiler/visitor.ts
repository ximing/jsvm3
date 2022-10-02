import * as t from '@babel/types';

// Base class for classes that perform ast transformation
// Any subclass must return a node on the type-specific methods
// or null to delete that node
export class Visitor {
  visit(node: any) {
    if (node instanceof Array) {
      return this.visitArray(node);
    }
    if (node && node.type) {
      // @ts-ignore
      if (!this[node.type]) {
        throw new Error(`${node.type} 未实现`);
      }
      // @ts-ignore
      return this[node.type](node);
    }
    if (node) {
      throw new Error('unexpected node');
    }
    return null;
  }

  visitArray(array: any[]) {
    let i = 0;
    while (i < array.length) {
      if (!array[i]) {
        i++;
        continue;
      }
      const result = this.visit(array[i]);
      if (result) {
        array[i++] = result;
      } else {
        array.splice(i, 1);
      }
    }
    return array;
  }

  Program(node: t.Program) {
    node.body = this.visit(node.body);
    return node;
  }

  EmptyStatement(_: t.EmptyStatement) {
    return null;
  }

  BlockStatement(node: t.BlockStatement) {
    node.body = this.visit(node.body);
    return node;
  }

  ExpressionStatement(node: t.ExpressionStatement) {
    node.expression = this.visit(node.expression);
    return node;
  }

  IfStatement(node: t.IfStatement) {
    node.test = this.visit(node.test);
    node.consequent = this.visit(node.consequent);
    node.alternate = this.visit(node.alternate);
    return node;
  }

  ReturnStatement(node: t.ReturnStatement) {
    node.argument = this.visit(node.argument);
    return node;
  }

  WhileStatement(node: t.WhileStatement) {
    node.test = this.visit(node.test);
    node.body = this.visit(node.body);
    return node;
  }

  DoWhileStatement(node: t.DoWhileStatement) {
    node.body = this.visit(node.body);
    node.test = this.visit(node.test);
    return node;
  }

  ForStatement(node: t.ForStatement) {
    node.test = this.visit(node.test);
    node.body = this.visit(node.body);
    node.init = this.visit(node.init);
    node.update = this.visit(node.update);
    return node;
  }

  DebuggerStatement(node: t.DebuggerStatement) {
    return node;
  }

  VariableDeclaration(node: t.VariableDeclaration) {
    node.declarations = this.visit(node.declarations);
    return node;
  }

  VariableDeclarator(node: t.VariableDeclarator) {
    node.id = this.visit(node.id);
    node.init = this.visit(node.init);
    return node;
  }

  UnaryExpression(node: t.UnaryExpression) {
    node.argument = this.visit(node.argument);
    return node;
  }

  BinaryExpression(node: t.BinaryExpression) {
    node.left = this.visit(node.left);
    node.right = this.visit(node.right);
    return node;
  }

  Identifier(node: t.Identifier) {
    return node;
  }

  StringLiteral(node: t.StringLiteral) {
    return node;
  }

  NumericLiteral(node: t.NumericLiteral) {
    return node;
  }

  BooleanLiteral(node: t.BooleanLiteral) {
    return node;
  }

  NullLiteral(node: t.NullLiteral) {
    return node;
  }

  Literal(node: t.Literal) {
    return node;
  }

  ArrowFunctionExpression(node: t.ArrowFunctionExpression) {
    node.params = this.visit(node.params);
    // node.defaults = this.visit(node.defaults);
    // node.rest = this.visit(node.rest);
    node.body = this.visit(node.body);
    return node;

    throw new Error('not implemented');
  }
}
