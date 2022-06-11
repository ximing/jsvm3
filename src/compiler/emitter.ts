import * as t from '@babel/types';
import { Visitor } from './visitor';
import { hasProp } from '../utils/helper';
import { Instruction } from '../opcodes/types';
import {
  COLUMN,
  DECLG,
  DEL,
  ENTER_SCOPE,
  EXIT_SCOPE,
  GETG,
  GETL,
  GLOBAL,
  LINE,
  LITERAL,
  SETG,
  SETL,
  SREXP,
  STRING_LITERAL,
  UNDEF,
} from '../opcodes';
import * as OPCODES from '../opcodes';
import { Label } from '../opcodes/label';
import { Script } from '../vm/script';
import { binaryOp, unaryOp } from './opMap';
import { Guard } from '../vm/types';

type EmitterLabel = {
  name: string | null;
  stmt: any;
  brk?: Label;
  cont?: Label;
  cleanup?: any[] | null;
};

export class Emitter extends Visitor {
  fName: string;
  name: string | null;
  original: string[];
  source: string;
  instructions: Instruction[];
  labels: EmitterLabel[];
  children: any[];
  tryStatements: any[];
  withLevel: number;
  scopes: any[];
  scriptScope: any;
  globalNames: any[];
  localNames: any[];
  varIndex: number;
  guards: Guard[];
  currentLine: number;
  currentColumn: number;
  stringIds: Map<string, number>;
  strings: string[];
  regexpIds: Map<string, number>;
  regexps: RegExp[];
  ignoreNotDefined: number;

  constructor(
    scopes: any[] | null,
    fName: string,
    name: string | null,
    original: string[],
    source: string
  ) {
    super();
    this.fName = fName;
    this.name = name;
    this.original = original;
    this.source = source;
    this.instructions = [];
    this.labels = [];
    this.children = [];
    this.tryStatements = [];
    this.withLevel = 0;
    // Stack of scopes. Each scope maintains a name -> index association
    // where index is unique per script(function or code executing in global scope)
    this.scopes = scopes || [];
    if (scopes) {
      this.scriptScope = scopes[0];
    }
    this.globalNames = [];
    this.localNames = [];
    this.varIndex = 3;
    this.guards = [];
    this.currentLine = -1;
    this.currentColumn = -1;
    this.stringIds = new Map();
    this.strings = [];
    this.regexpIds = new Map();
    this.regexps = [];
    this.ignoreNotDefined = 0;
  }

  createINS(op: (args: any[] | null) => Instruction, ...args) {
    if (!op) {
      throw new Error('op必传');
    }
    if (!args.length) {
      // @ts-ignore
      args = null;
    }
    this.instructions.push(op(args));
  }

  scope(name: string) {
    let i = 0;
    let crossFunctionScope = false;
    for (const scope of this.scopes) {
      if (hasProp(scope, name)) {
        return [i, scope[name]];
      }
      // 只有在函数scope之后的scopes才会增加索引
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
      this.createINS(GETL, ...scope);
      return;
    }
    const idx = this.globalIdx(name);
    this.createINS(GETG, idx, this.ignoreNotDefined);
    this.ignoreNotDefined = 0;
  }

  globalIdx(name: string) {
    for (let i = 0; i < this.globalNames.length; i++) {
      if (this.globalNames[i] === name) {
        return i;
      }
    }
    return this.globalNames.push(name) - 1;
  }

  scopeSet(name, isDecl = false) {
    const scope = this.scope(name);
    if (scope) {
      return this.createINS(SETL, ...scope);
    }
    const idx = this.globalIdx(name);
    if (isDecl) {
      return this.createINS(DECLG, idx);
    } else {
      return this.createINS(SETG, idx);
    }
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

  declareVar(name, kind = 'let') {
    let scope;
    if (kind === 'var') {
      scope = this.scriptScope;
    } else {
      // 最新的scope
      scope = this.scopes[0];
    }
    if (scope && !scope[name]) {
      this.localNames[this.varIndex] = name;
      return (scope[name] = this.varIndex++);
    }
  }

  declarePattern(node, kind = 'let') {
    if (['ArrayPattern', 'ArrayExpression'].includes(node.type)) {
    } else if (['ObjectPattern', 'ObjectExpression'].includes(node.type)) {
    } else if (t.isIdentifier(node)) {
      return this.declareVar(node.name, kind);
    } else {
      throw new Error('assertion error');
    }
  }

  newLabel() {
    return new Label(this);
  }

  label(name?: string | null) {
    if (!name) {
      return this.labels[this.labels.length - 1];
    }
    for (const label of this.labels) {
      // console.log('---->', label.name, name);
      if (label.name === name) {
        return label;
      }
    }
    return null;
  }

  pushLabel(name: string | null, stmt: any, brk?: Label, cont?: Label) {
    // console.log('pushLabel', name, stmt, 'brk', brk, 'cont', cont);
    return this.labels.push({ name, stmt, brk, cont });
  }

  popLabel() {
    return this.labels.pop();
  }

  end() {
    let code, max;
    // console.log('this.instructions', this.instructions);
    for (code of Array.from(this.instructions)) {
      code.forEachLabel(function (l) {
        if (l.ip === null) {
          throw new Error('label has not been marked');
        }
        return l.ip;
      });
    }
    for (const guard of Array.from(this.guards)) {
      guard.start = (guard.start as Label).ip;
      if (guard.handler) {
        guard.handler = (guard.handler as Label).ip;
      }
      if (guard.finalizer) {
        guard.finalizer = (guard.finalizer as Label).ip;
      }
      guard.end = (guard.end as Label).ip;
    }
    // calculate the maximum evaluation stack size
    // at least 2 stack size is needed for the arguments object
    // and the self function reference
    let current = (max = 2);
    for (code of this.instructions) {
      current += code.calculateFactor();
      max = Math.max(current, max);
    }
    const localLength = this.localNames.length;
    // compile all functions
    for (let i = 0, end = this.children.length; i < end; i++) {
      this.children[i] = this.children[i]();
    }
    return new Script(
      this.fName,
      this.name,
      this.instructions,
      this.children,
      this.localNames,
      localLength,
      this.globalNames,
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
      /*
       * 首先检查节点的起始行号（node.loc.start.line）
       * 如果这个行号与this.currentLine（当前正在处理的行号）不同，表示代码进入了一个新的行。
       * 此时，会移除指令列表中末尾的与行号或列号相关的指令（这是为了避免重复或错误地标记行号），然后生成一个新的LINE指令来标记这个新行的开始，并更新this.currentLine。
       * 如果节点的起始列号（node.loc.start.column）与this.currentColumn不同，
       * 同样会移除指令列表中末尾的与列号相关的指令，生成一个新的COLUMN指令来标记新列的开始，并更新this.currentColumn。
       * */
      if (line !== this.currentLine) {
        idx = this.instructions.length - 1;
        while (
          idx >= 0 &&
          (this.instructions[idx].name === 'LINE' || this.instructions[idx].name === 'COLUMN')
        ) {
          this.instructions.pop();
          idx--;
        }
        this.createINS(LINE, line);
        this.currentLine = line;
      } else if (column !== this.currentColumn) {
        idx = this.instructions.length - 1;
        while (idx >= 0 && this.instructions[idx].name === 'COLUMN') {
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
      return this.createLiteral(memberExpression.property.name);
      // return this.createINS(LITERAL, memberExpression.property.name);
    } else if (t.isLiteral(memberExpression.property)) {
      return this.createLiteral(memberExpression.property.value);
      // return this.createINS(LITERAL, memberExpression.property.value);
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

  VariableDeclarator(node: t.VariableDeclarator & { kind: string }) {
    this.declarePattern(node.id, node.kind);
    if (node.init) {
      // 处理这种情况 var t1 = function(){ return typeof t1 };
      if (t.isFunctionExpression(node.init) && t.isIdentifier(node.id)) {
        if (!node.init.id) {
          // @ts-ignore
          node.init.id = {
            type: 'Identifier',
            name: node.id.name,
          };
        }
      }
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
    } else if (t.isIdentifier(node.id)) {
      this.scopeSet(node.id.name, true);
    } else {
      throw new Error(`VariableDeclarator 不支持类型${node.type}`);
    }
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
        this.createLiteral(node.argument.name);
        // this.createINS(LITERAL, node.argument.name);
        this.createINS(GLOBAL);
        this.createINS(DEL);
      } else {
        super.UnaryExpression(node);
        // @TODO 严格模式
        this.createINS(LITERAL, true);
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

  Identifier(node) {
    // 一个标识符。请注意，标识符可以是表达式(expression)或解构模式(destructuring pattern)
    this.scopeGet(node.name);
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
    this.createINS(LITERAL, null);
    return node;
  }

  Literal(node: t.Literal) {
    // @ts-ignore
    this.createLiteral(node.value);
    return node;
  }

  createString(val: string) {
    if (!this.stringIds.has(val)) {
      this.strings.push(val);
      const idx = this.strings.length - 1;
      this.stringIds.set(val, idx);
      return idx;
    }
    return this.stringIds.get(val);
  }

  createLiteral(val: any) {
    let idx;
    if (typeof val === 'undefined') {
      this.createINS(UNDEF);
      // variable-length literals(strings and regexps) are stored in arrays
      // and referenced by index
    } else if (typeof val === 'string') {
      idx = this.createString(val);
      this.createINS(STRING_LITERAL, idx);
    } else {
      this.createINS(LITERAL, val);
    }
  }

}