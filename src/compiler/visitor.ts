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

  LabeledStatement(node: t.LabeledStatement) {
    node.label = this.visit(node.label);
    node.body = this.visit(node.body);
    return node;
  }

  BreakStatement(node: t.BreakStatement) {
    node.label = this.visit(node.label);
    return node;
  }

  ContinueStatement(node: t.ContinueStatement) {
    node.label = this.visit(node.label);
    return node;
  }

  WithStatement(node: t.WithStatement) {
    node.object = this.visit(node.object);
    node.body = this.visit(node.body);
    return node;
  }

  SwitchStatement(node: t.SwitchStatement) {
    node.discriminant = this.visit(node.discriminant);
    node.cases = this.visit(node.cases);
    return node;
  }

  ReturnStatement(node: t.ReturnStatement) {
    node.argument = this.visit(node.argument);
    return node;
  }

  ThrowStatement(node: t.ThrowStatement) {
    node.argument = this.visit(node.argument);
    return node;
  }

  TryStatement(node: t.TryStatement) {
    node.block = this.visit(node.block);
    if (node.handler) {
      node.handler = this.visit(node.handler);
    }
    // node.guardedHandlers = this.visit(node.guardedHandlers);
    if (node.finalizer) {
      node.finalizer = this.visit(node.finalizer);
    }
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

  ForInStatement(node: t.ForInStatement) {
    node.left = this.visit(node.left);
    node.right = this.visit(node.right);
    node.body = this.visit(node.body);
    return node;
  }

  ForOfStatement(node: t.ForOfStatement) {
    node.left = this.visit(node.left);
    node.right = this.visit(node.right);
    node.body = this.visit(node.body);
    return node;
  }

  // esprima
  // LetStatement(node: t.VariableDeclaration) {
  //   node.head = this.visit(node.head);
  //   node.body = this.visit(node.body);
  //   return node;
  // }

  DebuggerStatement(node: t.DebuggerStatement) {
    return node;
  }

  // esprima
  FunctionDeclaration(node: t.FunctionDeclaration) {
    node.id = this.visit(node.id);
    node.params = this.visit(node.params);
    // node.defaults = this.visit(node.defaults);
    // node.rest = this.visit(node.rest);
    node.body = this.visit(node.body);
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

  ThisExpression(node: t.ThisExpression) {
    return node;
  }

  ArrayExpression(node: t.ArrayExpression) {
    node.elements = this.visit(node.elements);
    return node;
  }

  ObjectExpression(node: t.ObjectExpression) {
    for (const property of Array.from(node.properties)) {
      if (t.isSpreadElement(property)) {
        throw new Error('not support spread Element');
      }
      // @ts-ignore
      if (property.value) {
        // @ts-ignore
        property.value = this.visit(property.value);
      }
      // @ts-ignore
      if (property.body) {
        // @ts-ignore
        property.body = this.visit(property.body);
      }
      property.key = this.visit(property.key);
    }
    return node;
  }

  // exprima
  FunctionExpression(node: t.FunctionExpression) {
    node.id = this.visit(node.id);
    node.params = this.visit(node.params);
    node.body = this.visit(node.body);
    return node;
  }

  SequenceExpression(node: t.SequenceExpression) {
    node.expressions = this.visit(node.expressions);
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

  AssignmentExpression(node: t.AssignmentExpression) {
    node.right = this.visit(node.right);
    node.left = this.visit(node.left);
    return node;
  }

  UpdateExpression(node: t.UpdateExpression) {
    node.argument = this.visit(node.argument);
    return node;
  }

  LogicalExpression(node: t.LogicalExpression) {
    node.left = this.visit(node.left);
    node.right = this.visit(node.right);
    return node;
  }

  ConditionalExpression(node: t.ConditionalExpression) {
    node.test = this.visit(node.test);
    node.consequent = this.visit(node.consequent);
    node.alternate = this.visit(node.alternate);
    return node;
  }

  NewExpression(node: t.NewExpression) {
    node.callee = this.visit(node.callee);
    node.arguments = this.visit(node.arguments);
    return node;
  }

  CallExpression(node: t.CallExpression) {
    node.arguments = this.visit(node.arguments);
    node.callee = this.visit(node.callee);
    return node;
  }

  MemberExpression(node: t.MemberExpression) {
    node.object = this.visit(node.object);
    node.property = this.visit(node.property);
    return node;
  }

  ObjectPattern(node: t.ObjectPattern) {
    for (const property of Array.from(node.properties)) {
      if (t.isRestElement(property)) {
        throw new Error('rest element not implemented');
      }
      property.value = this.visit(property.value);
      property.key = this.visit(property.key);
    }
    return node;
  }

  ArrayPattern(node: t.ArrayPattern) {
    node.elements = this.visit(node.elements);
    return node;
  }

  SwitchCase(node: t.SwitchCase) {
    node.test = this.visit(node.test);
    node.consequent = this.visit(node.consequent);
    return node;
  }

  // exprima
  CatchClause(node: t.CatchClause) {
    node.param = this.visit(node.param);
    // node.guard = this.visit(node.guard);
    node.body = this.visit(node.body);
    return node;
  }

  Identifier(node: t.Identifier) {
    return node;
  }

  RegExpLiteral(node: t.RegExpLiteral) {
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

  YieldExpression(node: t.YieldExpression) {
    node.argument = this.visit(node.argument);
    return node;
  }

  // esprima
  // ComprehensionExpression(node: t.CompletionStatement) {
  //   node.body = this.visit(node.body);
  //   node.blocks = this.visit(node.blocks);
  //   node.filter = this.visit(node.filter);
  //   return node;
  // }

  ComprehensionBlock(node) {
    node.left = this.visit(node.pattern);
    node.right = this.visit(node.right);
    return node;
  }

  ClassExpression(_: t.ClassExpression) {
    throw new Error('not implemented');
  }

  ClassBody(_: t.ClassBody) {
    throw new Error('not implemented');
  }

  ClassDeclaration(_) {
    throw new Error('not implemented');
  }

  ClassHeritage(_) {
    throw new Error('not implemented');
  }

  ArrowFunctionExpression(node: t.ArrowFunctionExpression) {
    node.params = this.visit(node.params);
    // node.defaults = this.visit(node.defaults);
    // node.rest = this.visit(node.rest);
    node.body = this.visit(node.body);
    return node;

    throw new Error('not implemented');
  }

  ExportBatchSpecifier(_) {
    throw new Error('not implemented');
  }

  ExportSpecifier(_) {
    throw new Error('not implemented');
  }

  ExportDeclaration(_) {
    throw new Error('not implemented');
  }

  ImportSpecifier(_) {
    throw new Error('not implemented');
  }

  ImportDeclaration(_) {
    throw new Error('not implemented');
  }

  MethodDefinition(_) {
    throw new Error('not implemented');
  }

  Property(_) {
    throw new Error('not implemented');
  }

  ModuleDeclaration(_) {
    throw new Error('not implemented');
  }

  SpreadElement(_) {
    throw new Error('not implemented');
  }

  TemplateElement(_) {
    throw new Error('not implemented');
  }

  TaggedTemplateExpression(_) {
    throw new Error('not implemented');
  }

  TemplateLiteral(_) {
    throw new Error('not implemented');
  }
}
