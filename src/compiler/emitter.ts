import { Visitor } from './visitor';
import { hasProp } from '../utils/helper';
import { Instruction } from '../opcodes/types';
import {
  ARRAY_LITERAL,
  COLUMN,
  DEL,
  DUP,
  ENTER_SCOPE,
  EXIT_SCOPE,
  GET,
  GETG,
  GETL,
  GLOBAL,
  LINE,
  LITERAL,
  LR1,
  LR2,
  OBJECT_LITERAL,
  POP,
  REGEXP_LITERAL,
  SET,
  SETG,
  SETL,
  SR1,
  SR2,
  SREXP,
  STRING_LITERAL,
  SWAP,
  UNDEF,
} from '../opcodes';
import * as OPCODES from '../opcodes';
import { Label } from '../opcodes/label';
import { OPCodeIdx } from '../opcodes/opIdx';
import { regexpToString, Script } from '../vm/script';
import { binaryOp, unaryOp } from './opMap';
import * as t from '@babel/types';

export class Emitter extends Visitor {
  filename: string;
  name: string;
  source: string;
  instructions: Instruction[];
  labels: any[];
  scripts: any[];
  tryStatements: any[];
  withLevel: number;
  scopes: any[];
  scriptScope: any;
  localNames: any[];
  varIndex: number;
  guards: any[];
  currentLine: number;
  currentColumn: number;
  stringIds: Record<string, number>;
  strings: string[];
  regexpIds: Record<string, number>;
  regexps: RegExp[];
  ignoreNotDefined: number;

  constructor(scopes, filename, name, source) {
    super();
    this.filename = filename;
    this.name = name;
    this.source = source;
    this.instructions = [];
    this.labels = [];
    this.scripts = [];
    this.tryStatements = [];
    this.withLevel = 0;
    // Stack of scopes. Each scope maintains a name -> index association
    // where index is unique per script(function or code executing in global
    // scope)
    this.scopes = scopes || [];
    if (scopes) {
      this.scriptScope = scopes[0];
    }
    this.localNames = [];
    this.varIndex = 3;
    this.guards = [];
    this.currentLine = -1;
    this.currentColumn = -1;
    this.stringIds = {};
    this.strings = [];
    this.regexpIds = {};
    this.regexps = [];
    this.ignoreNotDefined = 0;
  }

  createINS(op: (args: any[] | null) => Instruction, ...args) {
    if (!args.length) {
      // @ts-ignore
      args = null;
    }
    this.instructions.push(op(args));
  }

  scope(name: string) {
    let i = 0;
    let crossFunctionScope = false;
    for (const scope of Array.from(this.scopes)) {
      if (hasProp(scope, name)) {
        return [i, scope[name]];
      }
      // only scopes after the function scope will increase the index
      if (crossFunctionScope || scope === this.scriptScope) {
        crossFunctionScope = true;
        i++;
      }
    }
    return null;
  }

  scopeGet(name: string) {
    const scope = this.scope(name);
    if (scope) {
      this.ignoreNotDefined = 0;
      this.createINS(GETL, scope);
      return;
    }
    this.createINS(GETG, name, this.ignoreNotDefined);
    this.ignoreNotDefined = 0;
  }

  scopeSet(name) {
    const scope = this.scope(name);
    if (scope) {
      return this.createINS(SETL, scope);
    }
    return this.createINS(SETG, name); // global object set
  }

  enterScope() {
    if (!this.scopes.length) {
      // 运行全局代码时仅进入嵌套范围，因为局部变量由整数而非名称标识
      this.createINS(ENTER_SCOPE);
    }
    return this.scopes.unshift({});
  }

  exitScope() {
    this.scopes.shift();
    if (!this.scopes.length) {
      return this.createINS(EXIT_SCOPE);
    }
  }

  declareVar(name, kind) {
    let scope;
    if (kind === 'var') {
      scope = this.scriptScope;
    } else {
      scope = this.scopes[0];
    }
    if (scope && !scope[name]) {
      this.localNames[this.varIndex] = name;
      return (scope[name] = this.varIndex++);
    }
  }

  declarePattern(node, kind) {
    if (['ArrayPattern', 'ArrayExpression'].includes(node.type)) {
      const result: any[] = [];
      for (const el of Array.from(node.elements)) {
        if (el) {
          result.push(this.declarePattern(el, kind));
        } else {
          result.push(undefined);
        }
      }
      return result;
    } else if (['ObjectPattern', 'ObjectExpression'].includes(node.type)) {
      return Array.from(node.properties).map((prop: any) => this.declarePattern(prop.value, kind));
    } else if (node.type === 'Identifier') {
      return this.declareVar(node.name, kind);
    } else {
      throw new Error('assertion error');
    }
  }

  newLabel() {
    return new Label(this);
  }

  label(name) {
    if (!name) {
      return this.labels[this.labels.length - 1];
    }
    for (const label of Array.from(this.labels)) {
      if (label.name === name) {
        return label;
      }
    }
    return null;
  }

  pushLabel(name, stmt, brk?, cont?) {
    return this.labels.push({ name, stmt, brk, cont });
  }

  popLabel() {
    return this.labels.pop();
  }

  end() {
    let code, max;
    console.log('this.instructions', this.instructions);
    for (code of Array.from(this.instructions)) {
      code.forEachLabel(function (l) {
        if (l.ip === null) {
          throw new Error('label has not been marked');
        }
        return l.ip;
      });
    }
    for (const guard of Array.from(this.guards)) {
      guard.start = guard.start.ip;
      if (guard.handler) {
        guard.handler = guard.handler.ip;
      }
      if (guard.finalizer) {
        guard.finalizer = guard.finalizer.ip;
      }
      guard.end = guard.end.ip;
    }
    // calculate the maximum evaluation stack size
    // at least 2 stack size is needed for the arguments object
    // and the self function reference
    let current = (max = 2);
    for (code of Array.from(this.instructions)) {
      current += code.calculateFactor();
      max = Math.max(current, max);
    }
    let localLength = 0;
    for (const _ of Array.from(this.localNames)) {
      localLength++;
    }
    // compile all functions
    for (let i = 0, end = this.scripts.length; i < end; i++) {
      this.scripts[i] = this.scripts[i]();
    }
    return new Script(
      this.filename,
      this.name,
      this.instructions,
      this.scripts,
      this.localNames,
      localLength,
      this.guards,
      max,
      this.strings,
      this.regexps,
      this.source
    );
  }

  visit(node: any) {
    if (node == null) {
      // eg: the 'alternate' block of an if statement
      return;
    }
    if (node.loc) {
      let idx;
      const { line, column } = node.loc.start;
      if (line !== this.currentLine) {
        idx = this.instructions.length - 1;
        while (
          idx >= 0 &&
          (this.instructions[idx].id === OPCodeIdx.LINE ||
            this.instructions[idx].id === OPCodeIdx.COLUMN)
        ) {
          this.instructions.pop();
          idx--;
        }
        this.createINS(LINE, line);
        this.currentLine = line;
      } else if (column !== this.currentColumn) {
        idx = this.instructions.length - 1;
        while (idx >= 0 && this.instructions[idx].id === OPCodeIdx.COLUMN) {
          this.instructions.pop();
          idx--;
        }
        this.createINS(COLUMN, column);
        this.currentColumn = column;
      }
    }
    return super.visit(node);
  }

  visitProperty(memberExpression) {
    if (memberExpression.computed) {
      return this.visit(memberExpression.property);
    } else if (memberExpression.property.type === 'Identifier') {
      return this.createINS(LITERAL, memberExpression.property.name);
    } else if (memberExpression.property.type === 'Literal') {
      return this.createINS(LITERAL, memberExpression.property.value);
    } else {
      throw new Error('invalid assert');
    }
  }

  BlockStatement(node) {
    this.enterScope();
    if (node.blockInit) {
      node.blockInit();
    }
    this.visit(node.body);
    if (node.blockCleanup) {
      node.blockCleanup();
    }
    this.exitScope();
    return node;
  }

  ExpressionStatement(node) {
    super.ExpressionStatement(node);
    // remove the expression value from the stack and save it
    this.createINS(SREXP);
    return node;
  }

  LabeledStatement(node) {
    const brk = this.newLabel();
    this.pushLabel(node.label.name, node.body, brk);
    this.visit(node.body);
    brk.mark();
    this.popLabel();
    return node;
  }

  DebuggerStatement(node) {
    // this.createINS(DEBUG);
    return node;
  }

  VariableDeclaration(node) {
    for (const decl of node.declarations) {
      decl.kind = node.kind;
    }
    this.visit(node.declarations);
    return node;
  }

  VariableDeclarator(node) {
    this.declarePattern(node.id, node.kind);
    if (node.init) {
      const assign = {
        type: 'ExpressionStatement',
        expression: {
          loc: node.loc,
          type: 'AssignmentExpression',
          operator: '=',
          left: node.id,
          right: node.init,
        },
      };
      this.visit(assign);
    }
    return node;
  }

  ArrayExpression(node) {
    super.ArrayExpression(node);
    this.createINS(ARRAY_LITERAL, node.elements.length);
    return node;
  }

  ObjectExpression(node) {
    for (const property of node.properties) {
      if (property.kind === 'init') {
        // object literal
        this.visit(property.value);
        if (property.key.type === 'Literal') {
          this.visit(property.key);
        } else {
          // identifier. use the name to create a literal string
          this.visit({ type: 'Literal', value: property.key.name });
        }
      } else {
        throw new Error(`property kind '${property.kind}' not implemented`);
      }
    }
    this.createINS(OBJECT_LITERAL, node.properties.length);
    return node;
  }

  SequenceExpression(node) {
    let i, end;
    for (i = 0, end = node.expressions.length - 1; i < end; i++) {
      this.visit(node.expressions[i]);
      this.createINS(POP);
    }
    this.visit(node.expressions[i]);
    return node;
  }

  UnaryExpression(node) {
    if (node.operator === 'delete') {
      if (node.argument.type === 'MemberExpression') {
        this.visitProperty(node.argument);
        this.visit(node.argument.object);
        this.createINS(DEL);
      } else if (node.argument.type === 'Identifier' && !this.scopes.length) {
        // global property
        this.createINS(LITERAL, node.argument.name);
        this.createINS(GLOBAL);
        this.createINS(DEL);
      } else {
        // no-op
        this.createINS(LITERAL, false);
      }
    } else {
      if (node.operator === 'typeof' && node.argument.type === 'Identifier') {
        this.ignoreNotDefined = 1;
      }
      super.UnaryExpression(node);
      this.createINS(OPCODES[unaryOp[node.operator]]);
    }
    return node;
  }

  BinaryExpression(node) {
    super.BinaryExpression(node);
    this.createINS(OPCODES[binaryOp[node.operator]]);
    return node;
  }

  // LogicalExpression(node) {
  //   const evalEnd = this.newLabel();
  //   this.visit(node.left);
  //   this.DUP();
  //   if (node.operator === '||') {
  //     this.JMPT(evalEnd);
  //   } else {
  //     this.JMPF(evalEnd);
  //   }
  //   this.POP();
  //   this.visit(node.right);
  //   evalEnd.mark();
  //   return node;
  // }

  ConditionalExpression(node) {
    this.IfStatement(node);
    return node;
  }

  MemberExpression(node) {
    this.visitProperty(node);
    this.visit(node.object);
    this.createINS(GET);
    return node;
  }

  AssignmentExpression(node) {
    if (node.right) {
      if (node.right.type === 'MemberExpression' && !node.right.object) {
        // destructuring pattern, need to adjust the stack before
        // getting the value
        this.visitProperty(node.right);
        this.createINS(SWAP);
        this.createINS(GET);
      } else {
        this.visit(node.right);
      }
    }
    // else, assume value is already on the stack
    if (
      ['ArrayPattern', 'ArrayExpression', 'ObjectPattern', 'ObjectExpression'].includes(
        node.left.type
      )
    ) {
      let childAssignment;
      if (['ArrayPattern', 'ArrayExpression'].includes(node.left.type)) {
        let index = 0;
        for (const element of Array.from(node.left.elements)) {
          if (element) {
            this.createINS(DUP);
            // get the nth-item from the array
            childAssignment = {
              operator: node.operator,
              type: 'AssignmentExpression',
              left: element,
              right: {
                type: 'MemberExpression',
                // omit the object since its already loaded on stack
                property: { type: 'Literal', value: index },
              },
            };
            this.visit(childAssignment);
            this.createINS(POP);
          }
          index++;
        }
      } else {
        for (const property of node.left.properties) {
          this.createINS(DUP);
          const source = property.key;
          const target = property.value;
          childAssignment = {
            operator: node.operator,
            type: 'AssignmentExpression',
            left: target,
            right: {
              type: 'MemberExpression',
              computed: true,
              property: { type: 'Literal', value: source.name },
            },
          };
          this.visit(childAssignment);
          this.createINS(POP);
        }
      }
      return;
    }
    if (node.left.type === 'MemberExpression') {
      this.visitProperty(node.left);
      this.visit(node.left.object);
      this.createINS(SR2);
      this.createINS(SR1);
      if (node.operator !== '=') {
        this.createINS(LR1);
        this.createINS(LR2);
        this.createINS(GET); // get current value

        // swap new/old values
        // @SWAP()
        // apply operator
        this.createINS(OPCODES[binaryOp[node.operator.slice(0, node.operator.length - 1)]]);
        this.createINS(LR1); // load property
        this.createINS(LR2); // load object
        this.createINS(SET); // set
      } else {
        this.createINS(LR1); // load property
        this.createINS(LR2); // load object
        this.createINS(SET); // set
      }
    } else {
      if (node.operator !== '=') {
        this.scopeGet(node.left.name);
        this.createINS(SWAP);
        // apply operator
        this.createINS(OPCODES[binaryOp[node.operator.slice(0, node.operator.length - 1)]]);
      }
      this.scopeSet(node.left.name); // set value
    }
    return node;
  }

  Identifier(node) {
    // 一个标识符。请注意，标识符可以是表达式(expression)或解构模式(destructuring pattern)
    this.scopeGet(node.name);
    return node;
  }

  RegExpLiteral(node: t.RegExpLiteral) {
    this.Literal(node);
    return node;
  }

  StringLiteral(node: t.StringLiteral) {
    this.Literal(node);
    return node;
  }

  NumericLiteral(node: t.NumericLiteral) {
    this.Literal(node);
    return node;
  }

  BooleanLiteral(node: t.BooleanLiteral) {
    this.Literal(node);
    return node;
  }

  NullLiteral(node: t.NullLiteral) {
    this.Literal(node);
    return node;
  }

  Literal(node) {
    let idx;
    const val = node.value;
    if (typeof val === 'undefined') {
      this.createINS(UNDEF);
      // variable-length literals(strings and regexps) are stored in arrays
      // and referenced by index
    } else if (typeof val === 'string') {
      if (!hasProp(this.stringIds, val)) {
        this.strings.push(val);
        idx = this.strings.length - 1;
        this.stringIds[val] = idx;
      }
      idx = this.stringIds[val];
      this.createINS(STRING_LITERAL, idx);
    } else if (val instanceof RegExp) {
      const id = regexpToString(val);
      if (!hasProp(this.regexpIds, id)) {
        this.regexps.push(val);
        idx = this.regexps.length - 1;
        this.regexpIds[id] = idx;
      }
      idx = this.regexpIds[id];
      this.createINS(REGEXP_LITERAL, idx);
    } else {
      this.createINS(LITERAL, val);
    }
    return node;
  }

  ComprehensionExpression() {
    // An array comprehension. The blocks array corresponds to the sequence
    // of for and for each blocks. The optional filter expression corresponds
    // to the final if clause, if present
    throw new Error('not implemented');
  }

  ComprehensionBlock() {
    // A for or for each block in an array comprehension or generator expression
    throw new Error('not implemented');
  }

  ClassExpression(_) {
    throw new Error('not implemented');
  }

  ClassBody(_) {
    throw new Error('not implemented');
  }

  ClassDeclaration(_) {
    throw new Error('not implemented');
  }

  ClassHeritage(_) {
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
