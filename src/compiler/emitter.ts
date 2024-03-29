import * as t from '@babel/types';
import { parse } from '@babel/parser';
import { Visitor } from './visitor';
import { hasProp } from '../utils/helper';
import { Instruction } from '../opcodes/types';
import {
  ARRAY_LITERAL,
  CALL,
  CALLM,
  CID,
  COLUMN,
  DEC,
  DECLG,
  DEL,
  DUP,
  ENTER_GUARD,
  ENTER_SCOPE,
  ENUMERATE,
  EXIT_GUARD,
  EXIT_SCOPE,
  FUNCTION,
  FUNCTION_SETUP,
  GET,
  GETG,
  GETL,
  GLOBAL,
  INC,
  ITER,
  JMP,
  JMPF,
  JMPT,
  LINE,
  LITERAL,
  LLHS,
  LR1,
  LR2,
  LR3,
  NEW,
  NEXT,
  OBJECT_LITERAL,
  PAUSE,
  POP,
  REGEXP_LITERAL,
  RET,
  RETV,
  SET,
  SETG,
  SETL,
  SLHS,
  SR1,
  SR2,
  SR3,
  SREXP,
  STRING_LITERAL,
  SWAP,
  THROW,
  UNDEF,
} from '../opcodes';
import * as OPCODES from '../opcodes';
import { Label } from '../opcodes/label';
import { Script } from '../vm/script';
import { binaryOp, unaryOp } from './opMap';
import { regexpFromString } from '../utils/convert';
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

  addCleanupHook(cleanup: (label?: EmitterLabel, isBreak?: boolean) => any) {
    // 向所有命名标签添加清理指令
    for (const label of this.labels) {
      if (label.name) {
        if (!label.cleanup) {
          label.cleanup = [];
        }
        label.cleanup.push(cleanup);
      }
    }
    // 还添加到所有可能退出块的封闭块(try/catch/finally)
    return this.tryStatements.map((tryStatement) => tryStatement.hooks.push(cleanup));
  }

  declareFunction(name, index, generator = false) {
    let opcode;
    this.declareVar(name);
    const scope = this.scope(name);
    if (scope) {
      opcode = SETL(scope);
    } else {
      const idx = this.globalIdx(name);
      opcode = SETG([idx]);
    }
    // 通过将名称绑定到函数 ref 来声明函数,  在其他不是函数声明的语句之前
    const codes = [FUNCTION([index, generator === false ? 0 : 1]), opcode, POP(null)];
    this.instructions = codes.concat(this.instructions);
    const processedLabels = {};
    const result: any[] = [];

    for (let i = 0, end = this.instructions.length; i < end; i++) {
      const code: any = this.instructions[i];
      /*
      * var C = function () {
          console.log(C); <---  考虑这种情况
          function C() {}
          return C;
        }();
      * */
      // 用local scope内匹配索引的 GETL 替换parent scope内声明名称匹配的所有 GETG/GETL 指令
      if (this.scopes.length && code?.name === 'GETG') {
        const idx = this.globalIdx(name);
        if (code.args[0] === idx) {
          this.instructions[i] = GETL(scope);
        }
      }
      if (code?.name === 'GETL') {
        if (code.args[0] !== 0) {
          const s = this.scopes[code.args[0]];
          if (s[name] === code.args[1]) {
            this.instructions[i] = GETL(scope);
          }
        }
      }
      // 更新所有标签偏移量
      result.push(
        code.forEachLabel(function (l) {
          if (hasProp(processedLabels, l.id)) {
            // 相同的标签可以在指令之间重复使用，这将确保我们只访问每个标签一次
            return l;
          }
          processedLabels[l.id] = null;
          if (l.ip != null) {
            // only offset marked labels
            l.ip += 3;
          }
          return l;
        })
      );
    }
    return result;
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

  LabeledStatement(node) {
    const brk = this.newLabel();
    // const cont = this.newLabel();
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

  ArrayExpression(node: t.ArrayExpression) {
    // super.ArrayExpression(node);
    node.elements = node.elements.map((ele) => {
      if (ele === null) {
        this.createINS(UNDEF);
        return undefined;
      }
      return this.visit(ele);
    });
    this.createINS(ARRAY_LITERAL, node.elements.length);
    return node;
  }

  ObjectExpression(node: t.ObjectExpression) {
    for (const property of node.properties) {
      let value: any;
      if (property.type === 'SpreadElement') {
        throw new Error('not implemented SpreadElement');
      }
      if (property.type === 'ObjectMethod') {
        value = {
          type: 'FunctionExpression',
          start: property.start,
          end: property.end,
          loc: property.loc,
          id: null,
          generator: property.generator,
          async: property.async,
          params: property.params,
          body: property.body,
        };
      } else {
        value = property.value;
      }
      // 重写 function name
      if (!value.id && t.isFunctionExpression(value)) {
        let id: any = null;
        if (t.isLiteral(property.key)) {
          // @ts-ignore
          id = `${property.key.value}`;
        }
        if (t.isIdentifier(property.key) && !property.computed) {
          id = (property.key as t.Identifier).name;
        }
        // @ts-ignore
        value.id = {
          type: 'Identifier',
          name: id,
          // @ts-ignore
          functionType: property.type,
        };
      }
      this.visit(value);
      if (t.isLiteral(property.key)) {
        this.visit(property.key);
      } else if (t.isIdentifier(property.key)) {
        if (property.computed) {
          this.visit(property.key);
        } else {
          // Identifier. use the name to create a literal string
          this.visit({ type: 'Literal', value: (property.key as t.Identifier).name });
        }
      } else if (t.isExpression(property.key)) {
        this.visit(property.key);
      } else {
        throw new Error(`ObjectExpression not implemented ${property.key}`);
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

  UpdateExpression(node) {
    if (node.argument.type === 'MemberExpression') {
      this.visitProperty(node.argument);
      this.visit(node.argument.object);
      this.createINS(SLHS);
      this.createINS(LLHS);
      // this.createINS(SR2);
      // this.createINS(SR1);
      // this.createINS(LR1);
      // this.createINS(LR2);
      this.createINS(GET); // get current
      this.createINS(SR3); // save current
      this.createINS(LR3); // load current
      if (node.operator === '++') {
        this.createINS(INC);
      } else {
        this.createINS(DEC);
      } // apply operator
      this.createINS(LR1); // load property
      this.createINS(LR2); // load object
      this.createINS(SET); // load object
    } else {
      this.scopeGet(node.argument.name);
      this.createINS(SR3);
      this.createINS(LR3);
      if (node.operator === '++') {
        this.createINS(INC);
      } else {
        this.createINS(DEC);
      }
      this.scopeSet(node.argument.name);
    }
    if (!node.prefix) {
      this.createINS(POP);
      this.createINS(LR3);
    }
    return node;
  }

  LogicalExpression(node) {
    const evalEnd = this.newLabel();
    this.visit(node.left);
    this.createINS(DUP);
    // 短路逻辑
    if (node.operator === '||') {
      this.createINS(JMPT, evalEnd);
    } else {
      this.createINS(JMPF, evalEnd);
    }
    this.createINS(POP);
    this.visit(node.right);
    evalEnd.mark();
    return node;
  }

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
    // 参考 variableDeclaration.test.ts 下  continuous define continuous assignment  测试用例
    if (node.left.type === 'MemberExpression') {
      this.visitProperty(node.left);
      this.visit(node.left.object);
      this.createINS(SLHS);
      // this.createINS(SR2);
      // this.createINS(SR1);
    }
    if (node.right) {
      if (node.right.type === 'MemberExpression' && !node.right.object) {
        // destructuring pattern, need to adjust the stack before getting the value
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
      if (node.operator !== '=') {
        this.createINS(LLHS);
        // this.createINS(SR2); // object
        // this.createINS(SR1); // property
        // this.createINS(LR1); // property
        // this.createINS(LR2); // object
        this.createINS(GET); // get current value
        this.createINS(SWAP);
        const op = node.operator.slice(0, node.operator.length - 1);
        this.createINS(OPCODES[binaryOp[op]]);
        this.createINS(LR1); // load property
        this.createINS(LR2); // load object
        this.createINS(SET); // set
      } else {
        // this.createINS(LR1); // load property
        // this.createINS(LR2); // load object
        this.createINS(LLHS);
        this.createINS(SET); // set
      }
    } else {
      if (node.operator !== '=') {
        this.scopeGet(node.left.name);
        this.createINS(SWAP);
        const op = node.operator.slice(0, node.operator.length - 1);
        // apply operator
        this.createINS(OPCODES[binaryOp[op]]);
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
    // this.Literal(node);
    let idx;
    const id = `${node.pattern}/${node.flags}`;
    const val = regexpFromString(id);
    if (!this.regexpIds.has(id)) {
      idx = this.regexps.push(val) - 1;
      this.regexpIds.set(id, idx);
    }
    idx = this.regexpIds.get(id);
    this.createINS(REGEXP_LITERAL, idx);
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

  IfStatement(node) {
    const ifTrue = this.newLabel();
    const end = this.newLabel();
    this.visit(node.test);
    this.createINS(JMPT, ifTrue);
    this.visit(node.alternate);
    this.createINS(JMP, end);
    ifTrue.mark();
    this.visit(node.consequent);
    end.mark();
    return node;
  }

  /*
  * switch(a){
      case 1:
        a = 2
      default:
        a = 3
    }
    discriminant: a
    cases:[SwitchCase{consequent,test}]
  * */
  SwitchStatement(node: t.SwitchStatement) {
    const brk = this.newLabel();
    this.pushLabel(null, node, brk);
    this.addCleanupHook(() => {
      this.createINS(POP);
      return this.exitScope();
    });
    this.enterScope();
    this.visit(node.discriminant);
    let nextBlock = this.newLabel();
    for (const clause of node.cases) {
      const nextTest = this.newLabel();
      if (clause.test) {
        this.createINS(DUP);
        this.visit(clause.test);
        this.createINS(CID);
        this.createINS(JMPF, nextTest);
        this.createINS(JMP, nextBlock);
      }
      if (clause.consequent.length) {
        nextBlock.mark();
        this.visit(clause.consequent);
        nextBlock = this.newLabel();
        this.createINS(JMP, nextBlock); // fall to the next block
      }
      nextTest.mark();
    }
    nextBlock.mark();
    this.popLabel();
    brk.mark();
    this.createINS(POP);
    this.exitScope();
    return node;
  }

  BreakStatement(node) {
    let label;
    if (node.label) {
      label = this.label(node.label.name);
      if (label.cleanup) {
        for (const cleanup of label.cleanup) {
          cleanup(label, true);
        }
      }
    } else {
      label = this.label();
    }
    this.createINS(JMP, label.brk);
    return node;
  }

  ContinueStatement(node: t.ContinueStatement) {
    let label;
    // 具名标签跳转
    if (node.label) {
      label = this.label(node.label.name);
      // console.log(label);
      if (label.cleanup) {
        for (const cleanup of label.cleanup) {
          cleanup!(label, false);
        }
      }
    } else {
      label = this.label();
    }
    this.createINS(JMP, label.cont);
    return node;
  }

  // break 参考：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/break#description
  // continue 参考：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/continue#description
  // In contrast to the break statement, continue does not terminate the execution of the loop entirely, but instead:
  // In a while loop, it jumps back to the condition.
  // In a for loop, it jumps to the update expression.
  VmLoop(node, emitInit, emitBeforeTest, emitUpdate?, emitAfterTest?) {
    const blockInit = () => {
      if (emitInit) {
        emitInit(brk);
      }
      if (emitUpdate) {
        start.mark();
      } else {
        // 排除 do while，因为continue 要跳转到 condition语句
        // if (!emitAfterTest) {
        //   cont.mark();
        // }
        cont.mark();
      }
      if (emitBeforeTest) {
        emitBeforeTest();
        return this.createINS(JMPF, brk);
      }
    };

    const blockCleanup = () => {
      if (emitUpdate) {
        cont.mark();
        emitUpdate(brk);
        this.createINS(POP);
        this.createINS(JMP, start);
      }
      if (emitAfterTest) {
        // do while case
        // cont.mark();
        currentLabel?.cont?.mark();
        emitAfterTest();
        this.createINS(JMPF, brk);
      }
      return this.createINS(JMP, cont);
    };

    const currentLabel = this.label();
    const start = this.newLabel();
    const cont = this.newLabel();
    const brk = this.newLabel();

    if ((currentLabel != null ? currentLabel.stmt : undefined) === node) {
      // 调整当前标签 'cont' 以便 'continue label' 起作用
      currentLabel!.cont = cont;
      if (emitAfterTest) {
        currentLabel!.cont = this.newLabel();
      }
    }
    this.pushLabel(null, node, brk, cont);
    if (node.body.type === 'BlockStatement') {
      node.body.blockInit = blockInit;
      node.body.blockCleanup = blockCleanup;
      this.visit(node.body);
    } else {
      this.enterScope();
      blockInit();
      this.visit(node.body);
      blockCleanup();
      this.exitScope();
    }
    brk.mark();
    this.popLabel();
    return node;
  }

  VmIteratorLoop(node, pushIterator) {
    const labelCleanup = (label, isBreak) => {
      if (!label || label.stmt !== node || isBreak) {
        return this.createINS(POP);
      }
    };

    const emitInit = (brk) => {
      if (node.left.type === 'VariableDeclaration') {
        this.visit(node.left);
      }
      this.visit(node.right);
      pushIterator();
      emitUpdate(brk);
      return this.createINS(POP);
    };

    const emitUpdate = (brk) => {
      this.createINS(DUP);
      this.createINS(NEXT, brk);
      return this.visit(assignNext()); // assign next to the iteration variable
    };

    const assignNext = () => ({
      loc: node.left.loc,
      type: 'AssignmentExpression',
      operator: '=',
      left: assignTarget,
    });

    this.addCleanupHook(labelCleanup);
    let assignTarget = node.left;
    if (assignTarget.type === 'VariableDeclaration') {
      assignTarget = node.left.declarations[0].id;
    }
    this.VmLoop(node, emitInit, null, emitUpdate);
    this.createINS(POP);
    return node;
  }

  WhileStatement(node) {
    const emitBeforeTest = () => {
      return this.visit(node.test);
    };

    this.VmLoop(node, null, emitBeforeTest);
    return node;
  }

  DoWhileStatement(node) {
    const emitAfterTest = () => {
      return this.visit(node.test);
    };

    this.VmLoop(node, null, null, null, emitAfterTest);
    return node;
  }

  ForStatement(node) {
    let emitInit: any = null;
    if (node.init) {
      emitInit = () => {
        this.visit(node.init);
        if (node.init.type !== 'VariableDeclaration') {
          return this.createINS(POP);
        }
      };
    }
    let emitBeforeTest: any = null;
    if (node.test) {
      emitBeforeTest = () => {
        return this.visit(node.test);
      };
    }
    let emitUpdate: any = null;
    if (node.update) {
      emitUpdate = () => {
        return this.visit(node.update);
      };
    }

    this.VmLoop(node, emitInit, emitBeforeTest, emitUpdate);
    return node;
  }

  ForInStatement(node) {
    const pushIterator = () => {
      return this.createINS(ENUMERATE);
    };

    this.VmIteratorLoop(node, pushIterator);
    return node;
  }

  ForOfStatement(node) {
    const pushIterator = () => {
      return this.createINS(ITER);
    };

    this.VmIteratorLoop(node, pushIterator);
    return node;
  }

  ReturnStatement(node) {
    // for hook in @returnHooks
    //   hook()
    if (node.argument) {
      this.visit(node.argument);
      this.createINS(RETV);
    } else {
      this.createINS(RET);
    }
    return node;
  }

  ThrowStatement(node) {
    super.ThrowStatement(node);
    this.createINS(THROW);
    return node;
  }

  TryStatement(node: t.TryStatement) {
    this.tryStatements.push({ hooks: [] });
    const start = this.newLabel();
    const handler = this.newLabel();
    const finalizer = this.newLabel();
    const end = this.newLabel();
    const guard = {
      start,
      handler: node.handler ? handler : null,
      finalizer: node.finalizer ? finalizer : null,
      end,
    };
    this.guards.push(guard);
    const guardId = this.guards.length - 1;
    this.createINS(ENTER_GUARD, guardId);
    start.mark();
    this.visit(node.block);
    this.createINS(JMP, finalizer);
    handler.mark();
    if (node.handler) {
      (node.handler.body as any).blockInit = () => {
        // bind error to the declared pattern
        const { param } = node.handler!;
        this.declarePattern(param);
        const assign = {
          type: 'ExpressionStatement',
          expression: {
            loc: param!.loc,
            type: 'AssignmentExpression',
            operator: '=',
            left: param,
          },
        };
        this.visit(assign);
        // run cleanup hooks
        return this.tryStatements[this.tryStatements.length - 1].hooks.map((hook) => hook());
      };
      this.visit(node.handler.body);
    }
    finalizer.mark();
    if (node.finalizer) {
      this.visit(node.finalizer);
      if (!node.handler) {
        for (const hook of this.tryStatements[this.tryStatements.length - 1].hooks) {
          hook();
        }
        // exit guard and pause to rethrow exception
        this.createINS(EXIT_GUARD, guardId);
        this.createINS(PAUSE);
      }
    }
    end.mark();
    this.createINS(EXIT_GUARD, guardId);
    this.tryStatements.pop();
    return node;
  }

  ThisExpression(node) {
    if (this.scopes.length) {
      this.scopeGet('this');
    } else {
      this.createINS(GLOBAL);
    }
    return node;
  }

  VmFunction(
    node: t.FunctionExpression & {
      lexicalThis: boolean;
      expression: boolean;
      isExpression: boolean;
      declare: boolean;
    }
  ) {
    const {
      start: { line: sline, column: scol },
      end: { line: eline, column: ecol },
    } = node.loc!;
    const original: string[] = this.original.slice(sline - 1, eline);
    original[0] = original[0].slice(scol);
    original[original.length - 1] = original[original.length - 1].slice(0, ecol);
    const source = original.join('\n');
    let name = '<a>';
    let functionType = '';
    if (node.id) {
      // @ts-ignore
      ({ name, functionType } = node.id);
    }
    // 仅在最后生成函数代码，以便它可以访问所有在其后定义的变量
    const emit = () => {
      let i;
      let end;
      const initialScope = { this: 0, arguments: 1 };
      /*
      * var d = {
          fy: function() {
              return typeof fy
          }
        };
        [d.fy.name, d.fy()] => [fy,undefined]
      * */
      if (node.id && !functionType) {
        // 具有name的函数可以引用自身
        initialScope[name] = 2;
      }
      if (node.lexicalThis) {
        // @ts-ignore
        delete initialScope.this;
      }
      const fn = new Emitter(
        [initialScope].concat(this.scopes),
        this.fName,
        name,
        this.original,
        source
      );
      fn.globalNames = this.globalNames;
      const len = node.params.length;
      // console.log(node.expression, node.isExpression, node.declare);
      // perform initial function call setup
      fn.createINS(FUNCTION_SETUP, node.id != null);
      // @TODO restElement
      // if (node.rest) {
      //   // 初始化剩余参数
      //   fn.declareVar(node.rest.name);
      //   const scope = fn.scope(node.rest.name);
      //   fn.createINS(REST, len, scope![1]);
      // }
      // 初始化参数
      for (i = 0, end = len; i < end; i++) {
        const param = node.params[i];
        // @TODO 默认值
        // const def = node.defaults[i];
        const declaration = parse(`var placeholder = arguments[${i}] || 0;`, {
          sourceType: 'module',
          plugins: [],
        }).program.body[0] as t.VariableDeclaration;
        const declarator = declaration.declarations[0];
        declarator.id = param;
        // if (def) {
        // @ts-ignore
        // declarator!.init!.right! = def;
        // } else {
        // @ts-ignore
        declarator.init = declarator.init.left;
        // }
        fn.visit(declaration);
      }
      // emit function body
      if (node.expression) {
        // 箭头表达式
        fn.visit(node.body);
        fn.createINS(RETV);
      } else {
        fn.visit(node.body.body);
      }
      // console.log(fn.instructions);
      const script = fn.end();
      script.paramsSize = len;
      return script;
    };
    const functionIndex = this.children.length;
    this.children.push(emit);
    if (node.isExpression) {
      // push function on the stack
      this.createINS(FUNCTION, functionIndex, node.generator === false ? 0 : 1);
    }
    if (node.declare) {
      // 声明以便函数可以绑定到最开始的context上
      this.declareFunction(node.declare, functionIndex, node.generator);
    }
    return node;
  }

  FunctionDeclaration(node) {
    node.isExpression = false;
    node.declare = node.id.name;
    this.VmFunction(node);
    return node;
  }

  FunctionExpression(node) {
    node.isExpression = true;
    node.declare = false;
    this.VmFunction(node);
    return node;
  }

  ArrowFunctionExpression(node) {
    node.isExpression = true;
    node.declare = false;
    node.lexicalThis = true;
    this.VmFunction(node);
    return node;
  }

  NewExpression(node) {
    this.visit(node.callee);
    this.visit(node.arguments); // push arguments
    this.createINS(NEW, node.arguments.length);
    return node;
  }

  CallExpression(node) {
    let fName;
    const len = node.arguments.length;
    if (node.callee.type === 'MemberExpression') {
      this.visit(node.callee.object); // push target
      this.createINS(SR1); // save target
      this.createINS(LR1); // load target
      this.visitProperty(node.callee); // push property
      if (node.callee.property.type === 'Identifier') {
        fName = node.callee.property.name;
      }
      this.visit(node.arguments); // push arguments
      const idx = this.createString(fName);
      this.createINS(CALLM, len, idx);
    } else {
      this.visit(node.callee);
      if (node.callee.type === 'Identifier') {
        fName = node.callee.name;
      }
      this.visit(node.arguments); // push arguments
      const idx = this.createString(fName);
      this.createINS(CALL, len, idx);
    }
    return node;
  }

  WithStatement(_) {
    throw new Error('not implemented');
    return _;
  }

  YieldExpression(node) {
    throw new Error('not implemented');
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
