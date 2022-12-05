/* eslint @typescript-eslint/no-unused-vars: 0 */
import { hasProp } from '../utils/helper';
import { throwErr } from '../utils/opcodes';
import { XYZReferenceError, XYZTypeError } from '../utils/errors';
import { Scope } from '../vm/scope';
import {
  add,
  and,
  ceq,
  cid,
  cneq,
  cnid,
  dec,
  del,
  div,
  enumerateKeys,
  exp,
  gt,
  gte,
  has,
  inc,
  instanceOf,
  inv,
  lnot,
  lt,
  lte,
  mod,
  mul,
  not,
  or,
  plu,
  sar,
  set,
  shl,
  shr,
  sub,
  xor,
} from './op';
import { call, callm, createFunction, createOP, ret } from './utils';
import { StopIteration } from '../vm/builtin';
// @ifdef COMPILER
import { OPCodeIdx } from './opIdx';
import { Cannot, property } from './contants';
// @endif
export const InsMap = new Map();

/*
 * 存储到寄存器1
 * */
export const SR1 = createOP(
  OPCodeIdx.SR1,
  function (frame, evalStack, scope, realm) {
    return (frame.fiber.r1 = evalStack.pop());
  },
  () => 0
);
export const SR2 = createOP(OPCodeIdx.SR2, function (frame, evalStack, scope, realm) {
  return (frame.fiber.r2 = evalStack.pop());
});

export const SR3 = createOP(OPCodeIdx.SR3, function (frame, evalStack, scope, realm) {
  return (frame.fiber.r3 = evalStack.pop());
});
/*
 * 从寄存器1读取
 * */
export const LR1 = createOP(
  OPCodeIdx.LR1,
  function (frame, evalStack, scope, realm) {
    return evalStack.push(frame.fiber.r1);
  },
  () => 1
);
export const LR2 = createOP(
  OPCodeIdx.LR2,
  function (frame, evalStack, scope, realm) {
    return evalStack.push(frame.fiber.r2);
  },
  () => 1
);
export const LR3 = createOP(
  OPCodeIdx.LR3,
  function (frame, evalStack, scope, realm) {
    return evalStack.push(frame.fiber.r3);
  },
  () => 1
);
/*
 * 存储到表达式寄存器
 * */
export const SREXP = createOP(OPCodeIdx.SREXP, function (frame, evalStack, scope, realm) {
  return (evalStack.fiber.rexp = evalStack.pop());
});

export const POP = createOP(OPCodeIdx.POP, function (frame, evalStack, scope, realm) {
  return evalStack.pop();
});

export const DUP = createOP(
  OPCodeIdx.DUP,
  function (frame, evalStack, scope, realm) {
    return evalStack.push(evalStack.top());
  },
  () => 1
);

export const SWAP = createOP(OPCodeIdx.SWAP, function (frame, evalStack, scope, realm) {
  const top = evalStack.pop();
  const bot = evalStack.pop();
  evalStack.push(top);
  return evalStack.push(bot);
});

export const GLOBAL = createOP(
  OPCodeIdx.GLOBAL,
  function (frame, evalStack, l, r) {
    return evalStack.push(r.global);
  },
  () => 1
);

export const SLHS = createOP(OPCodeIdx.SLHS, function (frame, evalStack, scope, realm) {
  const obj = evalStack.pop();
  const key = evalStack.pop();
  // console.log('SLHS', obj, key);
  return frame.lref.push([obj, key]);
});

export const LLHS = createOP(
  OPCodeIdx.LLHS,
  function (frame, evalStack, scope, realm) {
    const [obj, key] = frame.lref.pop();
    evalStack.push(key);
    return evalStack.push(obj);
  },
  () => 2
);
/*
 * 从对象中获取属性
 * */
export const GET = createOP(OPCodeIdx.GET, function (frame, evalStack, scope, realm) {
  const obj = evalStack.pop();
  const key = evalStack.pop();
  // console.log('--->GET', obj, key);
  if (obj == null) {
    // console.trace();
    return throwErr(frame, new XYZTypeError(`[XYZ] ${Cannot} get ${property} ${key} of ${obj}`));
  }
  return evalStack.push(obj[key]);
  // return evalStack.push(get(obj, key));
});

/*
 * 设置对象属性
 * */
export const SET = createOP(OPCodeIdx.SET, function (frame, evalStack, scope, realm) {
  const obj = evalStack.pop();
  const key = evalStack.pop();
  const val = evalStack.pop();
  if (obj == null) {
    return throwErr(frame, new XYZTypeError(`${Cannot} set ${property} ${key} of ${obj}`));
  }
  return evalStack.push(set(obj, key, val));
});

/*
 * 删除对象属性
 * */
export const DEL = createOP(OPCodeIdx.DEL, function (frame, evalStack, scope, realm) {
  const obj = evalStack.pop();
  const key = evalStack.pop();
  if (obj == null) {
    return throwErr(frame, new XYZTypeError(`${Cannot} convert null to object`));
  }
  return evalStack.push(del(obj, key));
});

/*
 * 获取局部变量
 * */
export const GETL = createOP(
  OPCodeIdx.GETL,
  function (frame, evalStack, scope, realm) {
    let scopeIndex = this.args[0];
    const varIndex = this.args[1];
    while (scopeIndex--) {
      scope = scope.parentScope!;
    }
    // console.log(scope, this.args, varIndex, scopeIndex, scope.get(varIndex));
    return evalStack.push(scope.get(varIndex));
  },
  () => 1
);

/*
 * 设置局部变量
 * */
export const SETL = createOP(OPCodeIdx.SETL, function (frame, evalStack, scope, realm) {
  let scopeIndex = this.args[0];
  const varIndex = this.args[1];
  let _scope = scope;
  while (scopeIndex--) {
    _scope = _scope.parentScope!;
  }
  return evalStack.push(_scope.set(varIndex, evalStack.pop()));
});

/*
 * 获取全局变量
 * */
export const GETG = createOP(
  OPCodeIdx.GETG,
  function (frame, evalStack, scope, realm) {
    const k = frame.script.globalNames[this.args[0]];
    // name, ignoreNotDefined
    // console.log(this.args[0], this.args[1]);
    if (!hasProp(realm.global, k) && !this.args[1]) {
      return throwErr(frame, new XYZReferenceError(`.${k} not def`));
    }
    // console.log(realm.global[this.args[0]]);
    return evalStack.push(realm.global[k]);
  },
  () => 1
);

/*
 * 设置全局变量
 * */
export const SETG = createOP(OPCodeIdx.SETG, function (frame, evalStack, scope, realm) {
  const k = frame.script.globalNames[this.args[0]];
  return evalStack.push((realm.global[k] = evalStack.pop()));
});

/*
 * 声明全局变量，考虑 __tests__/es5/global.test.ts case
 * */
export const DECLG = createOP(OPCodeIdx.DECLG, function (frame, evalStack, scope, realm) {
  const k = frame.script.globalNames[this.args[0]];
  if (!hasProp(realm.global, k)) {
    realm.global[k] = undefined;
  }
});

/*
 * invert signal
 * */
export const INV = createOP(OPCodeIdx.INV, function (frame, evalStack, scope, realm) {
  return evalStack.push(inv(evalStack.pop()));
});

export const PLU = createOP(OPCodeIdx.PLU, function (frame, evalStack, scope, realm) {
  return evalStack.push(plu(evalStack.pop()));
});

/*
 * logical NOT
 * */
export const LNOT = createOP(OPCodeIdx.LNOT, function (frame, evalStack, scope, realm) {
  return evalStack.push(lnot(evalStack.pop()));
});

/*
 * bitwise NOT
 * */
export const NOT = createOP(OPCodeIdx.NOT, function (frame, evalStack, scope, realm) {
  return evalStack.push(not(evalStack.pop()));
});

/*
 * increment
 * */
export const INC = createOP(OPCodeIdx.INC, function (frame, evalStack, scope, realm) {
  return evalStack.push(inc(evalStack.pop()));
});

/*
 * decrement
 * */
export const DEC = createOP(OPCodeIdx.DEC, function (frame, evalStack, scope, realm) {
  return evalStack.push(dec(evalStack.pop()));
});

/*
 * sum
 * */
export const ADD = createOP(OPCodeIdx.ADD, function (frame, evalStack, scope, realm) {
  return evalStack.push(add(evalStack.pop(), evalStack.pop()));
});
export const SUB = createOP(OPCodeIdx.SUB, function (frame, evalStack, scope, realm) {
  return evalStack.push(sub(evalStack.pop(), evalStack.pop()));
});
export const MUL = createOP(OPCodeIdx.MUL, function (frame, evalStack, scope, realm) {
  return evalStack.push(mul(evalStack.pop(), evalStack.pop()));
});
export const DIV = createOP(OPCodeIdx.DIV, function (frame, evalStack, scope, realm) {
  return evalStack.push(div(evalStack.pop(), evalStack.pop()));
});

export const MOD = createOP(OPCodeIdx.MOD, function (frame, evalStack, scope, realm) {
  return evalStack.push(mod(evalStack.pop(), evalStack.pop()));
});

// left shift
export const SHL = createOP(OPCodeIdx.SHL, function (frame, evalStack, scope, realm) {
  return evalStack.push(shl(evalStack.pop(), evalStack.pop()));
});
// right shift
export const SAR = createOP(OPCodeIdx.SAR, function (frame, evalStack, scope, realm) {
  return evalStack.push(sar(evalStack.pop(), evalStack.pop()));
});
// unsigned shift
export const SHR = createOP(OPCodeIdx.SHR, function (frame, evalStack, scope, realm) {
  return evalStack.push(shr(evalStack.pop(), evalStack.pop()));
});

export const OR = createOP(OPCodeIdx.OR, function (frame, evalStack, scope, realm) {
  return evalStack.push(or(evalStack.pop(), evalStack.pop()));
});
export const AND = createOP(OPCodeIdx.AND, function (frame, evalStack, scope, realm) {
  return evalStack.push(and(evalStack.pop(), evalStack.pop()));
});
// bitwise XOR
export const XOR = createOP(OPCodeIdx.XOR, function (frame, evalStack, scope, realm) {
  return evalStack.push(xor(evalStack.pop(), evalStack.pop()));
});
export const EXP = createOP(OPCodeIdx.EXP, function (frame, evalStack, scope, realm) {
  return evalStack.push(exp(evalStack.pop(), evalStack.pop()));
});

export const CEQ = createOP(OPCodeIdx.CEQ, function (frame, evalStack, scope, realm) {
  return evalStack.push(ceq(evalStack.pop(), evalStack.pop()));
});
export const CNEQ = createOP(OPCodeIdx.CNEQ, function (frame, evalStack, scope, realm) {
  return evalStack.push(cneq(evalStack.pop(), evalStack.pop()));
});

// 全等
export const CID = createOP(OPCodeIdx.CID, function (frame, evalStack, scope, realm) {
  return evalStack.push(cid(evalStack.pop(), evalStack.pop()));
});
export const CNID = createOP(OPCodeIdx.CNID, function (frame, evalStack, scope, realm) {
  return evalStack.push(cnid(evalStack.pop(), evalStack.pop()));
});
export const LT = createOP(OPCodeIdx.LT, function (frame, evalStack, scope, realm) {
  return evalStack.push(lt(evalStack.pop(), evalStack.pop()));
});
export const LTE = createOP(OPCodeIdx.LTE, function (frame, evalStack, scope, realm) {
  return evalStack.push(lte(evalStack.pop(), evalStack.pop()));
});
export const GT = createOP(OPCodeIdx.GT, function (frame, evalStack, scope, realm) {
  return evalStack.push(gt(evalStack.pop(), evalStack.pop()));
});
export const GTE = createOP(OPCodeIdx.GTE, function (frame, evalStack, scope, realm) {
  return evalStack.push(gte(evalStack.pop(), evalStack.pop()));
});
export const IN = createOP(OPCodeIdx.IN, function (frame, evalStack, scope, realm) {
  return evalStack.push(has(evalStack.pop(), evalStack.pop()));
});
export const INSTANCEOF = createOP(OPCodeIdx.INSTANCEOF, function (frame, evalStack, scope, realm) {
  return evalStack.push(instanceOf(evalStack.pop(), evalStack.pop()));
});
export const TYPEOF = createOP(OPCodeIdx.TYPEOF, function (frame, evalStack, scope, realm) {
  return evalStack.push(typeof evalStack.pop());
});
export const VOID = createOP(OPCodeIdx.VOID, function (frame, evalStack, scope, realm) {
  evalStack.pop();
  // eslint-disable-next-line no-void
  return evalStack.push(void 0);
});

export const UNDEF = createOP(
  OPCodeIdx.UNDEF,
  function (frame, evalStack, scope, realm) {
    // eslint-disable-next-line no-void
    return evalStack.push(void 0);
  },
  () => 1
);

// push 字面值
export const LITERAL = createOP(
  OPCodeIdx.LITERAL,
  function (frame, evalStack, scope, realm) {
    return evalStack.push(this.args[0]);
  },
  () => 1
);

// string对象
export const STRING_LITERAL = createOP(
  OPCodeIdx.STRING_LITERAL,
  function (frame, evalStack, scope, realm) {
    return evalStack.push(frame.script.strings[this.args[0]]);
  },
  () => 1
);

export const REGEXP_LITERAL = createOP(
  OPCodeIdx.REGEXP_LITERAL,
  function (frame, evalStack, scope, realm) {
    return evalStack.push(frame.script.regexps[this.args[0]]);
  },
  () => 1
);
// 对象字面量
export const OBJECT_LITERAL = createOP(
  OPCodeIdx.OBJECT_LITERAL,
  function (frame, evalStack, scope, realm) {
    // 对象里面有多少个属性
    let length = this.args[0];
    const rv: any[] = [];
    const obj = {};
    // 这里指令是反的，因为先进栈的后出栈，所以为了保持 for in 遍历对象的顺序，要再生成对象的时候做个revert
    while (length--) {
      rv.push([evalStack.pop(), evalStack.pop()]);
    }
    for (const [key, val] of rv.reverse()) {
      set(obj, key, val);
    }
    return evalStack.push(obj);
  },
  function () {
    return 1 - this.args[0] * 2;
  }
);
export const ARRAY_LITERAL = createOP(
  OPCodeIdx.ARRAY_LITERAL,
  function (frame, evalStack, scope, realm) {
    let length = this.args[0];
    const rv = new Array(length);
    while (length--) {
      rv[length] = evalStack.pop();
    }
    return evalStack.push(rv);
  },
  function () {
    return 1 - this.args[0];
  }
);

/*
 * 无条件跳转
 * */
export const JMP = createOP(OPCodeIdx.JMP, function (frame, evalStack, scope, realm) {
  return (frame.ip = this.args[0]);
});
/*
 * true 跳转
 * */
export const JMPT = createOP(OPCodeIdx.JMPT, function (frame, evalStack, scope, realm) {
  if (evalStack.pop()) {
    return (frame.ip = this.args[0]);
  }
});

/*
 * false 跳转
 * */
export const JMPF = createOP(OPCodeIdx.JMPF, function (frame, evalStack, scope, realm) {
  if (!evalStack.pop()) {
    return (frame.ip = this.args[0]);
  }
});

// push function reference
export const FUNCTION = createOP(
  OPCodeIdx.FUNCTION,
  function (frame, evalStack, l, r) {
    const scriptIndex = this.args[0];
    // frame.script.children[scriptIndex]  函数的body 指令集
    return evalStack.push(createFunction(frame.script.children[scriptIndex], l, r, this.args[1]));
  },
  () => 1
);

export const FUNCTION_SETUP = createOP(OPCodeIdx.FUNCTION_SETUP, function (frame, evalStack, l, r) {
  // 当前栈 情况 [fn, [Arguments] { '0': 2 },]
  l.set(1, evalStack.pop());
  const fn = evalStack.pop();
  if (this.args[0]) {
    return l.set(2, fn);
  }
});

// initialize 'rest' param
export const REST = createOP(OPCodeIdx.REST, function (frame, evalStack, l, r) {
  const index = this.args[0];
  const varIndex = this.args[1];
  const args = l.get(1);
  if (index < args.length) {
    return l.set(varIndex, Array.prototype.slice.call(args, index));
  }
});

// return from function
export const RET = createOP(OPCodeIdx.RET, function (frame, evalStack, scope, realm) {
  return ret(frame);
});

// return value from Function
export const RETV = createOP(OPCodeIdx.RETV, function (frame, evalStack, scope, realm) {
  frame.fiber.rv = evalStack.pop();
  return ret(frame);
});

// call as constructor
export const NEW = createOP(OPCodeIdx.NEW, function (frame, evalStack, scope, realm) {
  return call(frame, this.args[0], null, true);
});

// 调用函数
export const CALL = createOP(
  OPCodeIdx.CALL,
  function (frame, evalStack, scope, realm) {
    return call(frame, this.args[0], frame.script.strings[this.args[1]]);
  },
  function () {
    // pop弹出 n 个参数加上函数并压入返回值
    return 1 - (this.args[0] + 1);
  }
);
// call method
export const CALLM = createOP(
  OPCodeIdx.CALLM,
  function (frame, evalStack, scope, realm) {
    return callm(frame, this.args[0], null, null, frame.script.strings[this.args[1]]);
  },
  function () {
    // 弹出 n 个参数加上函数加上目标并推送返回值
    return 1 - (this.args[0] + 1 + 1);
  }
);
// calls 'iterator' method
export const ITER = createOP(OPCodeIdx.ITER, function (frame, evalStack, scope, realm) {
  return callm(frame, 0, 'iterator', evalStack.pop());
});
/*
 * 产生对象的可枚举属性
 * */
export const ENUMERATE = createOP(OPCodeIdx.ENUMERATE, function (frame, evalStack, scope, realm) {
  return evalStack.push(enumerateKeys(evalStack.pop()));
});
// calls iterator 'next'
export const NEXT = createOP(OPCodeIdx.NEXT, function (frame, evalStack, scope, realm) {
  callm(frame, 0, 'next', evalStack.pop());
  if (frame.evalError instanceof StopIteration) {
    frame.evalError = null;
    frame.suspended = false;
    return (frame.ip = this.args[0]);
  }
});
// pause frame
export const PAUSE = createOP(OPCodeIdx.PAUSE, function (frame, evalStack, scope, realm) {
  return (frame.suspended = true);
});

// yield value from generator
export const YIELD = createOP(OPCodeIdx.YIELD, function (frame, evalStack, scope, realm) {
  frame.fiber.yielded = evalStack.pop();
  return frame.fiber.suspend();
});

export const THROW = createOP(OPCodeIdx.THROW, function (frame, evalStack, scope, realm) {
  return throwErr(frame, evalStack.pop());
});

export const ENTER_GUARD = createOP(OPCodeIdx.ENTER_GUARD, function (frame, evalStack, scope, realm) {
  return frame.guards.push(frame.script.guards[this.args[0]]);
});

export const EXIT_GUARD = createOP(OPCodeIdx.EXIT_GUARD, function (frame, evalStack, scope, realm) {
  const currentGuard = frame.guards[frame.guards.length - 1];
  const specifiedGuard = frame.script.guards[this.args[0]];
  if (specifiedGuard === currentGuard) {
    return frame.guards.pop();
  }
});

/*
 * enter nested scope
 * */
export const ENTER_SCOPE = createOP(
  OPCodeIdx.ENTER_SCOPE,
  function (frame, evalStack, scope, realm) {
    return frame.setScope(
      new Scope(frame.getScope(), frame.script.localNames, frame.script.localLength)
    );
  }
);

/*
 * exit nested scope
 * */
export const EXIT_SCOPE = createOP(OPCodeIdx.EXIT_SCOPE, function (frame, evalStack, scope, realm) {
  return frame.setScope(frame.getScope()!.parentScope!);
});

/*
 * 设置行号
 * */
export const LINE = createOP(OPCodeIdx.LINE, function (frame, evalStack, scope, realm) {
  return frame.setLine(this.args[0]);
});

/*
 * 设置列号
 * */
export const COLUMN = createOP(OPCodeIdx.COLUMN, function (frame, evalStack, scope, realm) {
  return frame.setColumn(this.args[0]);
});

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DEBUG = createOP(OPCodeIdx.DEBUG, function (frame, evalStack, scope, r) {});
