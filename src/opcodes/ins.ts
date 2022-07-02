/* eslint @typescript-eslint/no-unused-vars: 0 */
import { call, callm, createFunction, createOP, ret } from './utils';
// @ifdef COMPILER
import { OPCodeIdx } from './opIdx';
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
 * 存储表达式结果到(表达式)寄存器中  Store Result of EXPression
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
