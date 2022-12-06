import type { Fiber } from './fiber';
import { Scope } from './scope';
import { Realm } from './realm';
import { EvaluationStack } from './stack';
import type { Script } from './script';
/* eslint @typescript-eslint/no-unused-vars: 0 */ // --> OFF
// import { OPCodeIdx } from '../opcodes/opIdx';
// import { throwErr } from '../utils/opcodes';
// import { XYZReferenceError, XYZTypeError } from '../utils/errors';
// import { Cannot, property } from '../opcodes/contants';
// import {
//   add,
//   and,
//   ceq,
//   cid,
//   cneq,
//   cnid,
//   dec,
//   del,
//   div,
//   enumerateKeys,
//   exp,
//   gt,
//   gte,
//   has,
//   inc,
//   instanceOf,
//   inv,
//   lnot,
//   lt,
//   lte,
//   mod,
//   mul,
//   not,
//   or,
//   plu,
//   sar,
//   set,
//   shl,
//   shr,
//   sub,
//   xor,
// } from '../opcodes/op';
// import { hasProp } from '../utils/helper';
// import { call, callm, createFunction, ret } from '../opcodes/utils';
// import { StopIteration } from './builtin';
import { Instruction } from '../opcodes/types';

export class Frame {
  fiber: Fiber;
  script: Script;
  _scope: Scope | null;

  evalError: any;
  suspended: boolean;

  realm: Realm;
  // frame name
  fName: any;
  evalStack: EvaluationStack;
  construct: any;

  ip: number;
  exitIp: number;
  finalizer: any;
  guards: any[];
  rv: any;
  lref: any[];

  line: number;
  column: number;

  constructor(
    fiber: Fiber,
    script: Script,
    s: Scope,
    realm: Realm,
    fName: string,
    construct = false
  ) {
    const t = this;
    t.fiber = fiber;
    t.script = script;
    t._scope = s;
    t.realm = realm;
    t.fName = fName;
    t.construct = construct;
    t.evalStack = new EvaluationStack(t.script.stackSize, t.fiber);
    t.ip = 0;
    t.exitIp = t.script.instructions.length;
    t.suspended = false;
    t.finalizer = null;
    t.guards = [];
    t.rv = undefined;
    t.line = t.column = -1;
    t.lref = [];
  }

  calc(ins: Instruction) {
    if (!this.fiber.insMap.has(ins.name)) {
      this.fiber.insMap.set(ins.name, { count: 0, time: 0 });
    }
    return this.fiber.insMap.get(ins.name);
  }

  run() {
    let len;
    const frame = this;
    const { instructions } = frame.script;
    while (frame.ip !== frame.exitIp && !frame.suspended && frame.fiber.timeout !== 0) {
      frame.fiber.timeout--;
      const ins = instructions[frame.ip++];
      const evalStack = frame.evalStack;
      const scope = frame._scope!;
      const realm = frame.realm;
      const args = ins.args;
      // const iii = this.calc(ins);
      // const now = process.hrtime();
      // switch (ins.id) {
      //   case OPCodeIdx.SR1: {
      //     frame.fiber.r1 = evalStack.pop();
      //     break;
      //   }
      //   case OPCodeIdx.SR2: {
      //     frame.fiber.r2 = evalStack.pop();
      //     break;
      //   }
      //   case OPCodeIdx.SR3: {
      //     frame.fiber.r3 = evalStack.pop();
      //     break;
      //   }
      //   case OPCodeIdx.LR1: {
      //     evalStack.push(frame.fiber.r1);
      //     break;
      //   }
      //   case OPCodeIdx.LR2: {
      //     evalStack.push(frame.fiber.r2);
      //     break;
      //   }
      //   case OPCodeIdx.LR3: {
      //     evalStack.push(frame.fiber.r3);
      //     break;
      //   }
      //   case OPCodeIdx.SREXP: {
      //     evalStack.fiber.rexp = evalStack.pop();
      //     break;
      //   }
      //   case OPCodeIdx.POP: {
      //     evalStack.pop();
      //     break;
      //   }
      //   case OPCodeIdx.DUP: {
      //     evalStack.push(evalStack.top());
      //     break;
      //   }
      //   case OPCodeIdx.SWAP: {
      //     const top = evalStack.pop();
      //     const bot = evalStack.pop();
      //     evalStack.push(top);
      //     evalStack.push(bot);
      //     break;
      //   }
      //   case OPCodeIdx.GLOBAL: {
      //     evalStack.push(realm.global);
      //     break;
      //   }
      //   case OPCodeIdx.SLHS: {
      //     const obj = evalStack.pop();
      //     const key = evalStack.pop();
      //     // console.log('SLHS', obj, key);
      //     frame.lref.push([obj, key]);
      //     break;
      //   }
      //   case OPCodeIdx.LLHS: {
      //     const [obj, key] = frame.lref.pop();
      //     frame.fiber.r1 = key;
      //     frame.fiber.r2 = obj;
      //     evalStack.push(key);
      //     evalStack.push(obj);
      //     break;
      //   }
      //   case OPCodeIdx.GET: {
      //     const obj = evalStack.pop();
      //     const key = evalStack.pop();
      //     // console.log('--->GET', obj, key);
      //     if (obj == null) {
      //       // console.trace();
      //       throwErr(frame, new XYZTypeError(`[XYZ] ${Cannot} get ${property} ${key} of ${obj}`));
      //     } else {
      //       evalStack.push(obj[key]);
      //     }
      //     // return evalStack.push(obj[key]);
      //     // return evalStack.push(get(obj, key));
      //     break;
      //   }
      //   case OPCodeIdx.SET: {
      //     const obj = evalStack.pop();
      //     const key = evalStack.pop();
      //     const val = evalStack.pop();
      //     if (obj == null) {
      //       throwErr(frame, new XYZTypeError(`${Cannot} set ${property} ${key} of ${obj}`));
      //     } else {
      //       evalStack.push(set(obj, key, val));
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.DEL: {
      //     const obj = evalStack.pop();
      //     const key = evalStack.pop();
      //     if (obj == null) {
      //       throwErr(frame, new XYZTypeError(`${Cannot} convert null to object`));
      //     } else {
      //       evalStack.push(del(obj, key));
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.GETL: {
      //     let scopeIndex = args[0];
      //     const varIndex = args[1];
      //     let _scope = scope;
      //     while (scopeIndex--) {
      //       _scope = _scope.parentScope!;
      //     }
      //     // console.log(_scope, args, varIndex, scopeIndex, _scope.get(varIndex));
      //     evalStack.push(_scope.get(varIndex));
      //     break;
      //   }
      //   case OPCodeIdx.SETL: {
      //     let scopeIndex = args[0];
      //     const varIndex = args[1];
      //     let _scope = scope;
      //     while (scopeIndex--) {
      //       _scope = _scope.parentScope!;
      //     }
      //     evalStack.push(_scope.set(varIndex, evalStack.pop()));
      //     break;
      //   }
      //   case OPCodeIdx.GETG: {
      //     const k = frame.script.globalNames[args[0]];
      //     // name, ignoreNotDefined
      //     // console.log(args[0], args[1]);
      //     if (!hasProp(realm.global, k) && !args[1]) {
      //       throwErr(frame, new XYZReferenceError(`.${k} not def`));
      //     } else {
      //       evalStack.push(realm.global[k]);
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.SETG: {
      //     const k = frame.script.globalNames[args[0]];
      //     evalStack.push((realm.global[k] = evalStack.pop()));
      //     break;
      //   }
      //   case OPCodeIdx.DECLG: {
      //     const k = frame.script.globalNames[args[0]];
      //     if (!hasProp(realm.global, k)) {
      //       realm.global[k] = undefined;
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.INV: {
      //     evalStack.push(-evalStack.pop());
      //     break;
      //   }
      //   case OPCodeIdx.PLU: {
      //     evalStack.push(+evalStack.pop());
      //     break;
      //   }
      //   case OPCodeIdx.LNOT: {
      //     evalStack.push(!evalStack.pop());
      //     break;
      //   }
      //   case OPCodeIdx.NOT: {
      //     evalStack.push(~evalStack.pop());
      //     break;
      //   }
      //   case OPCodeIdx.INC: {
      //     evalStack.push(evalStack.pop() + 1);
      //     break;
      //   }
      //   case OPCodeIdx.DEC: {
      //     evalStack.push(evalStack.pop() - 1);
      //     break;
      //   }
      //   case OPCodeIdx.ADD: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l + r);
      //     break;
      //   }
      //   case OPCodeIdx.SUB: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l - r);
      //     break;
      //   }
      //   case OPCodeIdx.MUL: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l * r);
      //     break;
      //   }
      //   case OPCodeIdx.DIV: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l / r);
      //     break;
      //   }
      //   case OPCodeIdx.MOD: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l % r);
      //     break;
      //   }
      //   case OPCodeIdx.SHL: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l << r);
      //     break;
      //   }
      //   case OPCodeIdx.SAR: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l >> r);
      //     break;
      //   }
      //   case OPCodeIdx.SHR: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l >>> r);
      //     break;
      //   }
      //   case OPCodeIdx.OR: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l | r);
      //     break;
      //   }
      //   case OPCodeIdx.AND: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l & r);
      //     break;
      //   }
      //   case OPCodeIdx.XOR: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l ^ r);
      //     break;
      //   }
      //   case OPCodeIdx.EXP: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(Math.pow(l, r));
      //     break;
      //   }
      //   case OPCodeIdx.CEQ: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l == r);
      //     break;
      //   }
      //   case OPCodeIdx.CNEQ: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l != r);
      //     break;
      //   }
      //   case OPCodeIdx.CID: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l === r);
      //     break;
      //   }
      //   case OPCodeIdx.CNID: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l !== r);
      //     break;
      //   }
      //   case OPCodeIdx.LT: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l < r);
      //     break;
      //   }
      //   case OPCodeIdx.LTE: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l <= r);
      //     break;
      //   }
      //   case OPCodeIdx.GT: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l > r);
      //     break;
      //   }
      //   case OPCodeIdx.GTE: {
      //     const [l, r] = evalStack.tail(2);
      //     evalStack.push(l >= r);
      //     break;
      //   }
      //   case OPCodeIdx.IN: {
      //     evalStack.push(has(evalStack.pop(), evalStack.pop()));
      //     break;
      //   }
      //   case OPCodeIdx.INSTANCEOF: {
      //     const [obj, klass] = evalStack.tail(2);
      //     evalStack.push(obj instanceof klass);
      //     break;
      //   }
      //   case OPCodeIdx.TYPEOF: {
      //     evalStack.push(typeof evalStack.pop());
      //     break;
      //   }
      //   case OPCodeIdx.VOID: {
      //     evalStack.pop();
      //     // eslint-disable-next-line no-void
      //     evalStack.push(void 0);
      //     break;
      //   }
      //   case OPCodeIdx.UNDEF: {
      //     // eslint-disable-next-line no-void
      //     evalStack.push(void 0);
      //     break;
      //   }
      //   case OPCodeIdx.LITERAL: {
      //     evalStack.push(args[0]);
      //     break;
      //   }
      //   case OPCodeIdx.STRING_LITERAL: {
      //     evalStack.push(frame.script.strings[args[0]]);
      //     break;
      //   }
      //   case OPCodeIdx.REGEXP_LITERAL: {
      //     evalStack.push(frame.script.regexps[args[0]]);
      //     break;
      //   }
      //   case OPCodeIdx.OBJECT_LITERAL: {
      //     const obj = {};
      //     const length = args[0];
      //     // // 对象里面有多少个属性
      //     // let length = args[0];
      //     // const rv: any[] = [];
      //     // // 这里指令是反的，因为先进栈的后出栈，所以为了保持 for in 遍历对象的顺序，要再生成对象的时候做个revert
      //     // while (length--) {
      //     //   rv.push([evalStack.pop(), evalStack.pop()]);
      //     // }
      //     // for (const [key, val] of rv.reverse()) {
      //     //   obj[key] = val;
      //     //   // set(obj, key, val);
      //     // }
      //     const rv = evalStack.tail(length + length);
      //     const l = rv.length;
      //     let i = 0;
      //     while (i < l) {
      //       const val = rv[i++];
      //       const key = rv[i++];
      //       obj[key] = val;
      //     }
      //     evalStack.push(obj);
      //     break;
      //   }
      //   case OPCodeIdx.ARRAY_LITERAL: {
      //     // let length = args[0];
      //     // const rv = new Array(length);
      //     // while (length--) {
      //     //   rv[length] = evalStack.pop();
      //     // }
      //     const rv = evalStack.tail(args[0]);
      //     evalStack.push(rv);
      //     break;
      //   }
      //   case OPCodeIdx.JMP: {
      //     frame.ip = args[0];
      //     break;
      //   }
      //   case OPCodeIdx.JMPT: {
      //     if (evalStack.pop()) {
      //       frame.ip = args[0];
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.JMPF: {
      //     if (!evalStack.pop()) {
      //       frame.ip = args[0];
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.FUNCTION: {
      //     const scriptIndex = args[0];
      //     // frame.script.children[scriptIndex]  函数的body 指令集
      //     evalStack.push(createFunction(frame.script.children[scriptIndex], scope, realm, args[1]));
      //     break;
      //   }
      //   case OPCodeIdx.FUNCTION_SETUP: {
      //     // 当前栈 情况 [fn, [Arguments] { '0': 2 },]
      //     scope.set(1, evalStack.pop());
      //     const fn = evalStack.pop();
      //     if (args[0]) {
      //       scope.set(2, fn);
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.REST: {
      //     const index = args[0];
      //     const varIndex = args[1];
      //     const params = scope.get(1);
      //     if (index < params.length) {
      //       scope.set(varIndex, Array.prototype.slice.call(params, index));
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.RET: {
      //     ret(frame);
      //     break;
      //   }
      //   case OPCodeIdx.RETV: {
      //     frame.fiber.rv = evalStack.pop();
      //     ret(frame);
      //     break;
      //   }
      //   case OPCodeIdx.NEW: {
      //     call(frame, args[0], null, true);
      //     break;
      //   }
      //   case OPCodeIdx.CALL: {
      //     call(frame, args[0], frame.script.strings[args[1]]);
      //     break;
      //   }
      //   case OPCodeIdx.CALLM: {
      //     callm(frame, args[0], null, null, frame.script.strings[args[1]]);
      //     break;
      //   }
      //   case OPCodeIdx.ITER: {
      //     callm(frame, 0, 'iterator', evalStack.pop());
      //     break;
      //   }
      //   case OPCodeIdx.ENUMERATE: {
      //     evalStack.push(enumerateKeys(evalStack.pop()));
      //     break;
      //   }
      //   case OPCodeIdx.NEXT: {
      //     callm(frame, 0, 'next', evalStack.pop());
      //     if (frame.evalError instanceof StopIteration) {
      //       frame.evalError = null;
      //       frame.suspended = false;
      //       frame.ip = args[0];
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.PAUSE: {
      //     frame.suspended = true;
      //     break;
      //   }
      //   case OPCodeIdx.YIELD: {
      //     frame.fiber.yielded = evalStack.pop();
      //     frame.fiber.suspend();
      //     break;
      //   }
      //   case OPCodeIdx.THROW: {
      //     throwErr(frame, evalStack.pop());
      //     break;
      //   }
      //   case OPCodeIdx.ENTER_GUARD: {
      //     frame.guards.push(frame.script.guards[args[0]]);
      //     break;
      //   }
      //   case OPCodeIdx.EXIT_GUARD: {
      //     const currentGuard = frame.guards[frame.guards.length - 1];
      //     const specifiedGuard = frame.script.guards[args[0]];
      //     if (specifiedGuard === currentGuard) {
      //       frame.guards.pop();
      //     }
      //     break;
      //   }
      //   case OPCodeIdx.ENTER_SCOPE: {
      //     frame.setScope(new Scope(scope, frame.script.localNames, frame.script.localLength));
      //     break;
      //   }
      //   case OPCodeIdx.EXIT_SCOPE: {
      //     frame.setScope(scope!.parentScope!);
      //     break;
      //   }
      //   case OPCodeIdx.LINE: {
      //     // frame.setLine(args[0]);
      //     frame.line = args[0];
      //     break;
      //   }
      //   case OPCodeIdx.COLUMN: {
      //     frame.column = args[0];
      //     // frame.setColumn(args[0]);
      //     break;
      //   }
      //   case OPCodeIdx.DEBUG: {
      //     break;
      //   }
      //   default: {
      //     break;
      //   }
      // }

      // const iii = this.calc(ins);
      // const now = process.hrtime();

      ins.exec(frame, frame.evalStack, this._scope!, frame.realm, ins.args);

      // iii.count += 1;
      // const diff = process.hrtime(now);
      // iii.time += diff[0] * 1e9 + diff[1];
      // console.log(`\x1B[36m${ins.name}\x1B[0m`, ins.args, this.evalError, this.suspended, ins.id);
      // console.log(`\x1B[36m${ins.name}\x1B[0m`, ins.args !== null ? ins.args : '');
    }
    if (frame.fiber.timeout === 0) {
      frame.suspended = frame.fiber.suspended = true;
    }
    if (!frame.suspended && !frame.evalError && (len = frame.evalStack.len()) !== 0) {
      // debug assertion
      throw new Error(`eStack has ${len} items`);
    }
  }

  isDone() {
    return this.ip === this.exitIp;
  }

  // 方便terser 压缩 scope
  getScope() {
    return this._scope;
  }

  setScope(__s: Scope) {
    return (this._scope = __s);
  }

  // later we will use these methods to notify listeners(eg: debugger)
  // about line/column changes
  setLine(line) {
    this.line = line;
  }

  setColumn(column) {
    this.column = column;
  }
}
