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
import { OPCodeIdx } from '../opcodes/opIdx';
import { regexpToString, Script } from '../vm/script';
import { binaryOp, unaryOp } from './opMap';
import * as t from '@babel/types';
import { parse } from '@babel/parser';

export class Emitter extends Visitor {
  filename: string;
  name: string | null;
  original: string[];
  source: string;
  instructions: Instruction[];
  labels: { name: string | null; stmt: any; brk?: Label; cont?: Label; cleanup?: any[] | null }[];
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

  constructor(scopes, filename: string, name: string | null, original: string[], source: string) {
    super();
    this.filename = filename;
    this.name = name;
    this.original = original;
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
    this.createINS(GETG, name, this.ignoreNotDefined);
    this.ignoreNotDefined = 0;
  }

  scopeSet(name) {
    const scope = this.scope(name);
    if (scope) {
      return this.createINS(SETL, ...scope);
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

  declareVar(name, kind = 'let') {
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
    } else if (node.type === 'Identifier') {
      return this.declareVar(node.name, kind);
    } else {
      throw new Error('assertion error');
    }
  }

  newLabel() {
    return new Label(this);
  }

  label(name?) {
    if (!name) {
      return this.labels[this.labels.length - 1];
    }
    for (const label of this.labels) {
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

  addCleanupHook(cleanup) {
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
      opcode = SETG([name]);
    }
    // 通过将名称绑定到函数 ref 来声明函数,  在其他不是函数声明的语句之前
    const codes = [FUNCTION([index, generator]), opcode, POP(null)];
    this.instructions = codes.concat(this.instructions);
    const processedLabels = {};
    const result: any[] = [];
    for (let i = 0, end = this.instructions.length; i < end; i++) {
      const code: any = this.instructions[i];
      // replace all GETG/GETL instructions that match the declared name on
      // a parent scope by GETL of the matched index in the local scope
      if (this.scopes.length && code?.id === OPCodeIdx.GETG) {
        if (code.args[0] === name) {
          this.instructions[i] = GETL(scope);
        }
      }
      if (code?.id === OPCodeIdx.GETL) {
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
    for (code of this.instructions) {
      current += code.calculateFactor();
      max = Math.max(current, max);
    }
    const localLength = Array.from(this.localNames).length;
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

  UpdateExpression(node) {
    if (node.argument.type === 'MemberExpression') {
      this.visitProperty(node.argument);
      this.visit(node.argument.object);
      this.createINS(SR2);
      this.createINS(SR1);
      this.createINS(LR1);
      this.createINS(LR2);
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

  ContinueStatement(node) {
    let label;
    if (node.label) {
      label = this.label(node.label.name);
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

  VmLoop(node, emitInit, emitBeforeTest, emitUpdate?, emitAfterTest?) {
    const blockInit = () => {
      if (emitInit) {
        emitInit(brk);
      }
      if (emitUpdate) {
        start.mark();
      } else {
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
    const emitInit = () => {
      this.visit(node.init);
      if (node.init.type !== 'VariableDeclaration') {
        return this.createINS(POP);
      }
    };

    const emitBeforeTest = () => {
      return this.visit(node.test);
    };

    const emitUpdate = () => {
      return this.visit(node.update);
    };

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
    let name = '<ano>';
    if (node.id) {
      ({ name } = node.id);
    }
    // 仅在最后生成函数代码，以便它可以访问所有在其后定义的变量
    const emit = () => {
      let i;
      let end;
      const initialScope = { this: 0, arguments: 1 };
      if (node.id) {
        // 具有name的函数可以引用自身
        initialScope[name] = 2;
      }
      if (node.lexicalThis) {
        // @ts-ignore
        delete initialScope.this;
      }
      const fn = new Emitter(
        [initialScope].concat(this.scopes),
        this.filename,
        name,
        this.original,
        source
      );
      // console.log(node.expression, node.isExpression, node.declare);
      // perform initial function call setup
      fn.createINS(FUNCTION_SETUP, node.id != null);
      const len = node.params.length;
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
      return fn.end();
    };
    const functionIndex = this.scripts.length;
    this.scripts.push(emit);
    if (node.isExpression) {
      // push function on the stack
      this.createINS(FUNCTION, functionIndex, node.generator);
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
    this.visit(node.arguments); // push arguments
    this.visit(node.callee);
    this.createINS(NEW, node.arguments.length);
    return node;
  }

  CallExpression(node) {
    let fname;
    const len = node.arguments.length;
    this.visit(node.arguments); // push arguments
    if (node.callee.type === 'MemberExpression') {
      this.visit(node.callee.object); // push target
      this.createINS(SR1); // save target
      this.createINS(LR1); // load target
      this.visitProperty(node.callee); // push property
      if (node.callee.property.type === 'Identifier') {
        fname = node.callee.property.name;
      }
      this.createINS(CALLM, len, fname);
    } else {
      this.visit(node.callee);
      if (node.callee.type === 'Identifier') {
        fname = node.callee.name;
      }
      this.createINS(CALL, len, fname);
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
