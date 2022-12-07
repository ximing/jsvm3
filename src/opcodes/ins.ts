/* eslint @typescript-eslint/no-unused-vars: 0 */
import { hasProp } from '../utils/helper';
import { throwErr } from '../utils/opcodes';
import { XYZReferenceError, XYZTypeError } from '../utils/errors';
import { Scope } from '../vm/scope';
import { del, enumerateKeys, has, set } from './op';
import { call, callm, createFunction, createOP, ret } from './utils';
// @if CURRENT != 'exp'
import { StopIteration } from '../vm/builtin';
// @endif
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
  function (frame, evalStack, scope, realm, args) {
    frame.fiber.r1 = evalStack.pop();
  },
  () => 0
);
export const SR2 = createOP(OPCodeIdx.SR2, function (frame, evalStack, scope, realm, args) {
  frame.fiber.r2 = evalStack.pop();
});

export const SR3 = createOP(OPCodeIdx.SR3, function (frame, evalStack, scope, realm, args) {
  frame.fiber.r3 = evalStack.pop();
});
/*
 * 从寄存器1读取
 * */
export const LR1 = createOP(
  OPCodeIdx.LR1,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(frame.fiber.r1);
  },
  () => 1
);
export const LR2 = createOP(
  OPCodeIdx.LR2,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(frame.fiber.r2);
  },
  () => 1
);
export const LR3 = createOP(
  OPCodeIdx.LR3,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(frame.fiber.r3);
  },
  () => 1
);
/*
 * 存储到表达式寄存器
 * */
export const SREXP = createOP(OPCodeIdx.SREXP, function (frame, evalStack, scope, realm, args) {
  evalStack.fiber.rexp = evalStack.pop();
});

export const POP = createOP(OPCodeIdx.POP, function (frame, evalStack, scope, realm, args) {
  evalStack.pop();
});

export const DUP = createOP(
  OPCodeIdx.DUP,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(evalStack.top());
  },
  () => 1
);

export const SWAP = createOP(OPCodeIdx.SWAP, function (frame, evalStack, scope, realm, args) {
  // const top = evalStack.pop();
  // const bot = evalStack.pop();
  const [bot, top] = evalStack.tail(2);
  evalStack.push(top);
  evalStack.push(bot);
});

export const GLOBAL = createOP(
  OPCodeIdx.GLOBAL,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(realm.globalObj);
  },
  () => 1
);

export const SLHS = createOP(OPCodeIdx.SLHS, function (frame, evalStack, scope, realm, args) {
  // const obj = evalStack.pop();
  // const key = evalStack.pop();
  // console.log('SLHS', obj, key);
  // [key, obj]
  frame.lref.push(evalStack.tail(2));
});

export const LLHS = createOP(
  OPCodeIdx.LLHS,
  function (frame, evalStack, scope, realm, args) {
    const [key, obj] = frame.lref.pop();
    frame.fiber.r1 = key;
    frame.fiber.r2 = obj;
    evalStack.push(key);
    evalStack.push(obj);
  },
  () => 2
);
/*
 * 从对象中获取属性
 * */
export const GET = createOP(OPCodeIdx.GET, function (frame, evalStack, scope, realm, args) {
  // const obj = evalStack.pop();
  // const key = evalStack.pop();
  const [key, obj] = evalStack.tail(2);
  // console.log('--->GET', obj, key);
  if (obj == null) {
    // console.trace();
    throwErr(frame, new XYZTypeError(`[XYZ] ${Cannot} get ${property} ${key} of ${obj}`));
  } else {
    evalStack.push(obj[key]);
  }
  // return evalStack.push(obj[key]);
  // return evalStack.push(get(obj, key));
});

// @if CURRENT != 'exp'
/*
 * 设置对象属性
 * */
export const SET = createOP(OPCodeIdx.SET, function (frame, evalStack, scope, realm, args) {
  // const obj = evalStack.pop();
  // const key = evalStack.pop();
  // const val = evalStack.pop();
  const [val, key, obj] = evalStack.tail(3);
  if (obj == null) {
    throwErr(frame, new XYZTypeError(`${Cannot} set ${property} ${key} of ${obj}`));
  } else {
    evalStack.push(set(obj, key, val));
  }
  // return evalStack.push(set(obj, key, val));
});
/*
 * 删除对象属性
 * */
export const DEL = createOP(OPCodeIdx.DEL, function (frame, evalStack, scope, realm, args) {
  // const obj = evalStack.pop();
  // const key = evalStack.pop();
  const [key, obj] = evalStack.tail(2);
  if (obj == null) {
    throwErr(frame, new XYZTypeError(`${Cannot} convert null to object`));
  } else {
    evalStack.push(del(obj, key));
  }
  // return evalStack.push(del(obj, key));
});
// @endif

/*
 * 获取局部变量
 * */
export const GETL = createOP(
  OPCodeIdx.GETL,
  function (frame, evalStack, scope, realm, args) {
    let scopeIndex = args[0];
    const varIndex = args[1];
    while (scopeIndex--) {
      scope = scope.parentScope!;
    }
    // console.log(scope, args, varIndex, scopeIndex, scope.get(varIndex));
    evalStack.push(scope.get(varIndex));
  },
  () => 1
);
// @if CURRENT != 'exp'
/*
 * 设置局部变量
 * */
export const SETL = createOP(OPCodeIdx.SETL, function (frame, evalStack, scope, realm, args) {
  let scopeIndex = args[0];
  const varIndex = args[1];
  let _scope = scope;
  while (scopeIndex--) {
    _scope = _scope.parentScope!;
  }
  evalStack.push(_scope.set(varIndex, evalStack.pop()));
});
// @endif

/*
 * 获取全局变量
 * */
export const GETG = createOP(
  OPCodeIdx.GETG,
  function (frame, evalStack, scope, realm, args) {
    const k = frame.script.globalNames[args[0]];
    // name, ignoreNotDefined
    // console.log(args[0], args[1]);
    if (!hasProp(realm.globalObj, k) && !args[1]) {
      throwErr(frame, new XYZReferenceError(`.${k} not def`));
    } else {
      evalStack.push(realm.globalObj[k]);
    }
    // console.log(realm.globalObj[args[0]]);
    // return evalStack.push(realm.globalObj[k]);
  },
  () => 1
);
// @if CURRENT != 'exp'
/*
 * 设置全局变量
 * */
export const SETG = createOP(OPCodeIdx.SETG, function (frame, evalStack, scope, realm, args) {
  const k = frame.script.globalNames[args[0]];
  evalStack.push((realm.globalObj[k] = evalStack.pop()));
});
// @endif
/*
 * 声明全局变量，考虑 __tests__/es5/global.test.ts case
 * */
export const DECLG = createOP(OPCodeIdx.DECLG, function (frame, evalStack, scope, realm, args) {
  const k = frame.script.globalNames[args[0]];
  if (!hasProp(realm.globalObj, k)) {
    realm.globalObj[k] = undefined;
  }
});

/*
 * invert signal
 * */
export const INV = createOP(OPCodeIdx.INV, function (frame, evalStack, scope, realm, args) {
  evalStack.push(-evalStack.pop());
});

export const PLU = createOP(OPCodeIdx.PLU, function (frame, evalStack, scope, realm, args) {
  evalStack.push(+evalStack.pop());
});

/*
 * logical NOT
 * */
export const LNOT = createOP(OPCodeIdx.LNOT, function (frame, evalStack, scope, realm, args) {
  evalStack.push(!evalStack.pop());
});

/*
 * bitwise NOT
 * */
export const NOT = createOP(OPCodeIdx.NOT, function (frame, evalStack, scope, realm, args) {
  evalStack.push(~evalStack.pop());
});

/*
 * increment
 * */
export const INC = createOP(OPCodeIdx.INC, function (frame, evalStack, scope, realm, args) {
  evalStack.push(evalStack.pop() + 1);
});

/*
 * decrement
 * */
export const DEC = createOP(OPCodeIdx.DEC, function (frame, evalStack, scope, realm, args) {
  evalStack.push(evalStack.pop() - 1);
});

/*
 * sum
 * */
export const ADD = createOP(OPCodeIdx.ADD, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l + r);
});
export const SUB = createOP(OPCodeIdx.SUB, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l - r);
});
export const MUL = createOP(OPCodeIdx.MUL, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l * r);
});
export const DIV = createOP(OPCodeIdx.DIV, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l / r);
});

export const MOD = createOP(OPCodeIdx.MOD, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l % r);
});

// left shift
export const SHL = createOP(OPCodeIdx.SHL, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l << r);
});
// right shift
export const SAR = createOP(OPCodeIdx.SAR, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l >> r);
});
// unsigned shift
export const SHR = createOP(OPCodeIdx.SHR, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l >>> r);
});

export const OR = createOP(OPCodeIdx.OR, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l | r);
});
export const AND = createOP(OPCodeIdx.AND, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l & r);
});
// bitwise XOR
export const XOR = createOP(OPCodeIdx.XOR, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l ^ r);
});
export const EXP = createOP(OPCodeIdx.EXP, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(Math.pow(l, r));
});

export const CEQ = createOP(OPCodeIdx.CEQ, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l == r);
});
export const CNEQ = createOP(OPCodeIdx.CNEQ, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l != r);
});

// 全等
export const CID = createOP(OPCodeIdx.CID, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l === r);
});
export const CNID = createOP(OPCodeIdx.CNID, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l !== r);
});
export const LT = createOP(OPCodeIdx.LT, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l < r);
});
export const LTE = createOP(OPCodeIdx.LTE, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l <= r);
});
export const GT = createOP(OPCodeIdx.GT, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l > r);
});
export const GTE = createOP(OPCodeIdx.GTE, function (frame, evalStack, scope, realm, args) {
  const [l, r] = evalStack.tail(2);
  evalStack.push(l >= r);
});
export const IN = createOP(OPCodeIdx.IN, function (frame, evalStack, scope, realm, args) {
  evalStack.push(has(evalStack.pop(), evalStack.pop()));
});

export const INSTANCEOF = createOP(
  OPCodeIdx.INSTANCEOF,
  function (frame, evalStack, scope, realm, args) {
    const [obj, klass] = evalStack.tail(2);
    evalStack.push(obj instanceof klass);
  }
);

export const TYPEOF = createOP(OPCodeIdx.TYPEOF, function (frame, evalStack, scope, realm, args) {
  evalStack.push(typeof evalStack.pop());
});
export const VOID = createOP(OPCodeIdx.VOID, function (frame, evalStack, scope, realm, args) {
  evalStack.pop();
  // eslint-disable-next-line no-void
  evalStack.push(void 0);
});

export const UNDEF = createOP(
  OPCodeIdx.UNDEF,
  function (frame, evalStack, scope, realm, args) {
    // eslint-disable-next-line no-void
    evalStack.push(void 0);
  },
  () => 1
);

// push 字面值
export const LITERAL = createOP(
  OPCodeIdx.LITERAL,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(args[0]);
  },
  () => 1
);

// string对象
export const STRING_LITERAL = createOP(
  OPCodeIdx.STRING_LITERAL,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(frame.script.strings[args[0]]);
  },
  () => 1
);

export const REGEXP_LITERAL = createOP(
  OPCodeIdx.REGEXP_LITERAL,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(frame.script.regexps[args[0]]);
  },
  () => 1
);
// 对象字面量
export const OBJECT_LITERAL = createOP(
  OPCodeIdx.OBJECT_LITERAL,
  function (frame, evalStack, scope, realm, args) {
    const obj = {};
    const length = args[0];
    // // 对象里面有多少个属性
    // let length = args[0];
    // const rv: any[] = [];
    // // 这里指令是反的，因为先进栈的后出栈，所以为了保持 for in 遍历对象的顺序，要再生成对象的时候做个revert
    // while (length--) {
    //   rv.push([evalStack.pop(), evalStack.pop()]);
    // }
    // for (const [key, val] of rv.reverse()) {
    //   obj[key] = val;
    //   // set(obj, key, val);
    // }
    const rv = evalStack.tail(length + length);
    const l = rv.length;
    let i = 0;
    while (i < l) {
      const val = rv[i++];
      const key = rv[i++];
      obj[key] = val;
    }
    evalStack.push(obj);
  },
  function () {
    return 1 - this.args[0] * 2;
  }
);
export const ARRAY_LITERAL = createOP(
  OPCodeIdx.ARRAY_LITERAL,
  function (frame, evalStack, scope, realm, args) {
    // let length = args[0];
    // const rv = new Array(length);
    // while (length--) {
    //   rv[length] = evalStack.pop();
    // }
    const rv = evalStack.tail(args[0]);
    evalStack.push(rv);
  },
  function () {
    return 1 - this.args[0];
  }
);

/*
 * 无条件跳转
 * */
export const JMP = createOP(OPCodeIdx.JMP, function (frame, evalStack, scope, realm, args) {
  frame.ip = args[0];
});
/*
 * true 跳转
 * */
export const JMPT = createOP(OPCodeIdx.JMPT, function (frame, evalStack, scope, realm, args) {
  if (evalStack.pop()) {
    frame.ip = args[0];
  }
});

/*
 * false 跳转
 * */
export const JMPF = createOP(OPCodeIdx.JMPF, function (frame, evalStack, scope, realm, args) {
  if (!evalStack.pop()) {
    frame.ip = args[0];
  }
});
// @if CURRENT != 'exp'
// 创建函数
export const FUNCTION = createOP(
  OPCodeIdx.FUNCTION,
  function (frame, evalStack, scope, realm, args) {
    const scriptIndex = args[0];
    // frame.script.children[scriptIndex]  函数的body 指令集
    evalStack.push(createFunction(frame.script.children[scriptIndex], scope, realm, args[1]));
  },
  () => 1
);

export const FUNCTION_SETUP = createOP(
  OPCodeIdx.FUNCTION_SETUP,
  function (frame, evalStack, scope, realm, args) {
    // 当前栈 情况 [fn, [Arguments] { '0': 2 },]
    scope.set(1, evalStack.pop());
    const fn = evalStack.pop();
    if (args[0]) {
      scope.set(2, fn);
    }
  }
);

// initialize 'rest' param
export const REST = createOP(OPCodeIdx.REST, function (frame, evalStack, scope, realm, args) {
  const index = args[0];
  const varIndex = args[1];
  const params = scope.get(1);
  if (index < params.length) {
    scope.set(varIndex, Array.prototype.slice.call(params, index));
  }
});

//  from function
export const RET = createOP(OPCodeIdx.RET, function (frame, evalStack, scope, realm, args) {
  ret(frame);
});

//  value from Function
export const RETV = createOP(OPCodeIdx.RETV, function (frame, evalStack, scope, realm, args) {
  frame.fiber.rv = evalStack.pop();
  ret(frame);
});

// call as constructor
export const NEW = createOP(OPCodeIdx.NEW, function (frame, evalStack, scope, realm, args) {
  call(frame, args[0], null, true);
});

// 调用函数
export const CALL = createOP(
  OPCodeIdx.CALL,
  function (frame, evalStack, scope, realm, args) {
    call(frame, args[0], frame.script.strings[args[1]]);
  },
  function () {
    // pop弹出 n 个参数加上函数并压入返回值
    return 1 - (this.args[0] + 1);
  }
);
// call method
export const CALLM = createOP(
  OPCodeIdx.CALLM,
  function (frame, evalStack, scope, realm, args) {
    callm(frame, args[0], null, null, frame.script.strings[args[1]]);
  },
  function () {
    // 弹出 n 个参数加上函数加上目标并推送返回值
    return 1 - (this.args[0] + 1 + 1);
  }
);
// @endif

// @if CURRENT != 'exp'
// calls 'iterator' method
export const ITER = createOP(OPCodeIdx.ITER, function (frame, evalStack, scope, realm, args) {
  callm(frame, 0, 'iterator', evalStack.pop());
});
/*
 * 产生对象的可枚举属性
 * */
export const ENUMERATE = createOP(
  OPCodeIdx.ENUMERATE,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(enumerateKeys(evalStack.pop()));
  }
);
// 调用迭代器 'next'
export const NEXT = createOP(OPCodeIdx.NEXT, function (frame, evalStack, scope, realm, args) {
  callm(frame, 0, 'next', evalStack.pop());
  if (frame.evalError instanceof StopIteration) {
    frame.evalError = null;
    frame.suspended = false;
    frame.ip = args[0];
  }
});
// 终止 frame 执行
export const PAUSE = createOP(OPCodeIdx.PAUSE, function (frame, evalStack, scope, realm, args) {
  frame.suspended = true;
});
// yield value from generator
export const YIELD = createOP(OPCodeIdx.YIELD, function (frame, evalStack, scope, realm, args) {
  frame.fiber.yielded = evalStack.pop();
  frame.fiber.suspend();
});

export const THROW = createOP(OPCodeIdx.THROW, function (frame, evalStack, scope, realm, args) {
  throwErr(frame, evalStack.pop());
});

export const ENTER_GUARD = createOP(
  OPCodeIdx.ENTER_GUARD,
  function (frame, evalStack, scope, realm, args) {
    frame.guards.push(frame.script.guards[args[0]]);
  }
);

export const EXIT_GUARD = createOP(
  OPCodeIdx.EXIT_GUARD,
  function (frame, evalStack, scope, realm, args) {
    const currentGuard = frame.guards[frame.guards.length - 1];
    const specifiedGuard = frame.script.guards[args[0]];
    if (specifiedGuard === currentGuard) {
      frame.guards.pop();
    }
  }
);

export const ENTER_SCOPE = createOP(
  OPCodeIdx.ENTER_SCOPE,
  function (frame, evalStack, scope, realm, args) {
    frame.setScope(new Scope(scope, frame.script.localNames, frame.script.localLength));
  }
);

export const EXIT_SCOPE = createOP(
  OPCodeIdx.EXIT_SCOPE,
  function (frame, evalStack, scope, realm, args) {
    frame.setScope(scope!.parentScope!);
  }
);
// @endif

/*
 * 设置行号
 * */
export const LINE = createOP(OPCodeIdx.LINE, function (frame, evalStack, scope, realm, args) {
  frame.line = args[0];
  // frame.setLine(args[0]);
});

/*
 * 设置列号
 * */
export const COLUMN = createOP(OPCodeIdx.COLUMN, function (frame, evalStack, scope, realm, args) {
  frame.column = args[0];
  // frame.setColumn(args[0]);
});

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DEBUG = createOP(OPCodeIdx.DEBUG, function (frame, evalStack, scope, realm, args) {});
