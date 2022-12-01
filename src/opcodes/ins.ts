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
// @endif

/*
 * 存储到寄存器1
 * */
export const SR1 = createOP(
  OPCodeIdx.SR1,
  function (frame, _eStack) {
    return (frame.fiber.r1 = _eStack.pop());
  },
  () => 0
);
export const SR2 = createOP(OPCodeIdx.SR2, function (frame, _eStack) {
  return (frame.fiber.r2 = _eStack.pop());
});
export const SR3 = createOP(OPCodeIdx.SR3, function (frame, _eStack) {
  return (frame.fiber.r3 = _eStack.pop());
});
/*
 * 从寄存器1读取
 * */
export const LR1 = createOP(
  OPCodeIdx.LR1,
  function (frame, _eStack) {
    return _eStack.push(frame.fiber.r1);
  },
  () => 1
);
export const LR2 = createOP(
  OPCodeIdx.LR2,
  function (frame, _eStack) {
    return _eStack.push(frame.fiber.r2);
  },
  () => 1
);
export const LR3 = createOP(
  OPCodeIdx.LR3,
  function (frame, _eStack) {
    return _eStack.push(frame.fiber.r3);
  },
  () => 1
);
/*
 * 存储到表达式寄存器
 * */
export const SREXP = createOP(OPCodeIdx.SREXP, function (frame, _eStack) {
  return (_eStack.fiber.rexp = _eStack.pop());
});

export const POP = createOP(OPCodeIdx.POP, function (frame, _eStack) {
  return _eStack.pop();
});

export const DUP = createOP(
  OPCodeIdx.DUP,
  function (frame, _eStack) {
    return _eStack.push(_eStack.top());
  },
  () => 1
);

export const SWAP = createOP(OPCodeIdx.SWAP, function (frame, _eStack) {
  const top = _eStack.pop();
  const bot = _eStack.pop();
  _eStack.push(top);
  return _eStack.push(bot);
});

export const GLOBAL = createOP(
  OPCodeIdx.GLOBAL,
  function (f, _eStack, l, r) {
    return _eStack.push(r.global);
  },
  () => 1
);

export const SLHS = createOP(OPCodeIdx.SLHS, function (frame, _eStack) {
  const obj = _eStack.pop();
  const key = _eStack.pop();
  // console.log('SLHS', obj, key);
  return frame.lref.push([obj, key]);
});

export const LLHS = createOP(
  OPCodeIdx.LLHS,
  function (frame, _eStack) {
    const [obj, key] = frame.lref.pop();
    _eStack.push(key);
    return _eStack.push(obj);
  },
  () => 2
);
/*
 * 从对象中获取属性
 * */
export const GET = createOP(OPCodeIdx.GET, function (frame, _eStack) {
  const obj = _eStack.pop();
  const key = _eStack.pop();
  // console.log('--->GET', obj, key);
  if (obj == null) {
    // console.trace();
    return throwErr(frame, new XYZTypeError("[XYZ] Cannot read property '" + key + "' of " + obj));
  }
  return _eStack.push(obj[key]);
  // return _eStack.push(get(obj, key));
});

/*
 * 设置对象属性
 * */
export const SET = createOP(OPCodeIdx.SET, function (frame, _eStack) {
  const obj = _eStack.pop();
  const key = _eStack.pop();
  const val = _eStack.pop();
  if (obj == null) {
    return throwErr(frame, new XYZTypeError("Cannot set property '" + key + "' of " + obj));
  }
  return _eStack.push(set(obj, key, val));
});

/*
 * 删除对象属性
 * */
export const DEL = createOP(OPCodeIdx.DEL, function (frame, _eStack) {
  const obj = _eStack.pop();
  const key = _eStack.pop();
  if (obj == null) {
    return throwErr(frame, new XYZTypeError('Cannot convert null to object'));
  }
  return _eStack.push(del(obj, key));
});

/*
 * 获取局部变量
 * */
export const GETL = createOP(
  OPCodeIdx.GETL,
  function (frame, _eStack, s) {
    let scopeIndex = this.args[0];
    const varIndex = this.args[1];
    let scope = s;
    while (scopeIndex--) {
      scope = scope.parent!;
    }
    // console.log(scope, this.args, varIndex, scopeIndex, scope.get(varIndex));
    return _eStack.push(scope.get(varIndex));
  },
  () => 1
);

/*
 * 设置局部变量
 * */
export const SETL = createOP(OPCodeIdx.SETL, function (frame, _eStack, s) {
  let scopeIndex = this.args[0];
  const varIndex = this.args[1];
  let scope = s;
  while (scopeIndex--) {
    scope = scope.parent!;
  }
  return _eStack.push(scope.set(varIndex, _eStack.pop()));
});

/*
 * 获取全局变量
 * */
export const GETG = createOP(
  OPCodeIdx.GETG,
  function (frame, _eStack, scope, realm) {
    // name, ignoreNotDefined
    // console.log(this.args[0], this.args[1]);
    if (!hasProp(realm.global, this.args[0]) && !this.args[1]) {
      return throwErr(frame, new XYZReferenceError('' + this.args[0] + ' is not defined'));
    }
    // console.log(realm.global[this.args[0]]);
    return _eStack.push(realm.global[this.args[0]]);
  },
  () => 1
);

/*
 * 设置全局变量
 * */
export const SETG = createOP(OPCodeIdx.SETG, function (frame, _eStack, scope, realm) {
  return _eStack.push((realm.global[this.args[0]] = _eStack.pop()));
});

/*
 * 声明全局变量，考虑 __tests__/es5/global.test.ts case
 * */
export const DECLG = createOP(OPCodeIdx.DECLG, function (frame, _eStack, scope, realm) {
  if (!hasProp(realm.global, this.args[0])) {
    realm.global[this.args[0]] = undefined;
  }
});

/*
 * invert signal
 * */
export const INV = createOP(OPCodeIdx.INV, function (f, _eStack) {
  return _eStack.push(inv(_eStack.pop()));
});

export const PLU = createOP(OPCodeIdx.PLU, function (f, _eStack) {
  return _eStack.push(plu(_eStack.pop()));
});

/*
 * logical NOT
 * */
export const LNOT = createOP(OPCodeIdx.LNOT, function (f, _eStack) {
  return _eStack.push(lnot(_eStack.pop()));
});

/*
 * bitwise NOT
 * */
export const NOT = createOP(OPCodeIdx.NOT, function (f, _eStack) {
  return _eStack.push(not(_eStack.pop()));
});

/*
 * increment
 * */
export const INC = createOP(OPCodeIdx.INC, function (f, _eStack) {
  return _eStack.push(inc(_eStack.pop()));
});

/*
 * decrement
 * */
export const DEC = createOP(OPCodeIdx.DEC, function (f, _eStack) {
  return _eStack.push(dec(_eStack.pop()));
});

/*
 * sum
 * */
export const ADD = createOP(OPCodeIdx.ADD, function (f, _eStack) {
  return _eStack.push(add(_eStack.pop(), _eStack.pop()));
});
export const SUB = createOP(OPCodeIdx.SUB, function (f, _eStack) {
  return _eStack.push(sub(_eStack.pop(), _eStack.pop()));
});
export const MUL = createOP(OPCodeIdx.MUL, function (f, _eStack) {
  return _eStack.push(mul(_eStack.pop(), _eStack.pop()));
});
export const DIV = createOP(OPCodeIdx.DIV, function (f, _eStack) {
  return _eStack.push(div(_eStack.pop(), _eStack.pop()));
});

export const MOD = createOP(OPCodeIdx.MOD, function (f, _eStack) {
  return _eStack.push(mod(_eStack.pop(), _eStack.pop()));
});

// left shift
export const SHL = createOP(OPCodeIdx.SHL, function (f, _eStack) {
  return _eStack.push(shl(_eStack.pop(), _eStack.pop()));
});
// right shift
export const SAR = createOP(OPCodeIdx.SAR, function (f, _eStack) {
  return _eStack.push(sar(_eStack.pop(), _eStack.pop()));
});
// unsigned shift
export const SHR = createOP(OPCodeIdx.SHR, function (f, _eStack) {
  return _eStack.push(shr(_eStack.pop(), _eStack.pop()));
});

export const OR = createOP(OPCodeIdx.OR, function (f, _eStack) {
  return _eStack.push(or(_eStack.pop(), _eStack.pop()));
});
export const AND = createOP(OPCodeIdx.AND, function (f, _eStack) {
  return _eStack.push(and(_eStack.pop(), _eStack.pop()));
});
// bitwise XOR
export const XOR = createOP(OPCodeIdx.XOR, function (f, _eStack) {
  return _eStack.push(xor(_eStack.pop(), _eStack.pop()));
});
export const EXP = createOP(OPCodeIdx.EXP, function (f, _eStack) {
  return _eStack.push(exp(_eStack.pop(), _eStack.pop()));
});

export const CEQ = createOP(OPCodeIdx.CEQ, function (f, _eStack) {
  return _eStack.push(ceq(_eStack.pop(), _eStack.pop()));
});
export const CNEQ = createOP(OPCodeIdx.CNEQ, function (f, _eStack) {
  return _eStack.push(cneq(_eStack.pop(), _eStack.pop()));
});

// 全等
export const CID = createOP(OPCodeIdx.CID, function (f, _eStack) {
  return _eStack.push(cid(_eStack.pop(), _eStack.pop()));
});
export const CNID = createOP(OPCodeIdx.CNID, function (f, _eStack) {
  return _eStack.push(cnid(_eStack.pop(), _eStack.pop()));
});
export const LT = createOP(OPCodeIdx.LT, function (f, _eStack) {
  return _eStack.push(lt(_eStack.pop(), _eStack.pop()));
});
export const LTE = createOP(OPCodeIdx.LTE, function (f, _eStack) {
  return _eStack.push(lte(_eStack.pop(), _eStack.pop()));
});
export const GT = createOP(OPCodeIdx.GT, function (f, _eStack) {
  return _eStack.push(gt(_eStack.pop(), _eStack.pop()));
});
export const GTE = createOP(OPCodeIdx.GTE, function (f, _eStack) {
  return _eStack.push(gte(_eStack.pop(), _eStack.pop()));
});
export const IN = createOP(OPCodeIdx.IN, function (f, _eStack) {
  return _eStack.push(has(_eStack.pop(), _eStack.pop()));
});
export const INSTANCEOF = createOP(OPCodeIdx.INSTANCEOF, function (f, _eStack) {
  return _eStack.push(instanceOf(_eStack.pop(), _eStack.pop()));
});
export const TYPEOF = createOP(OPCodeIdx.TYPEOF, function (f, _eStack) {
  return _eStack.push(typeof _eStack.pop());
});
export const VOID = createOP(OPCodeIdx.VOID, function (f, _eStack) {
  _eStack.pop();
  // eslint-disable-next-line no-void
  return _eStack.push(void 0);
});

export const UNDEF = createOP(
  OPCodeIdx.UNDEF,
  function (f, _eStack) {
    // eslint-disable-next-line no-void
    return _eStack.push(void 0);
  },
  () => 1
);

// push 字面值
export const LITERAL = createOP(
  OPCodeIdx.LITERAL,
  function (f, _eStack) {
    return _eStack.push(this.args[0]);
  },
  () => 1
);

// string对象
export const STRING_LITERAL = createOP(
  OPCodeIdx.STRING_LITERAL,
  function (f, _eStack) {
    return _eStack.push(f.script.strings[this.args[0]]);
  },
  () => 1
);

export const REGEXP_LITERAL = createOP(
  OPCodeIdx.REGEXP_LITERAL,
  function (f, _eStack) {
    return _eStack.push(f.script.regexps[this.args[0]]);
  },
  () => 1
);
// 对象字面量
export const OBJECT_LITERAL = createOP(
  OPCodeIdx.OBJECT_LITERAL,
  function (f, _eStack) {
    // 对象里面有多少个属性
    let length = this.args[0];
    const rv: any[] = [];
    const obj = {};
    // 这里指令是反的，因为先进栈的后出栈，所以为了保持 for in 遍历对象的顺序，要再生成对象的时候做个revert
    while (length--) {
      rv.push([_eStack.pop(), _eStack.pop()]);
    }
    for (const [key, val] of rv.reverse()) {
      set(obj, key, val);
    }
    return _eStack.push(obj);
  },
  function () {
    return 1 - this.args[0] * 2;
  }
);
export const ARRAY_LITERAL = createOP(
  OPCodeIdx.ARRAY_LITERAL,
  function (frame, _eStack) {
    let length = this.args[0];
    const rv = new Array(length);
    while (length--) {
      rv[length] = _eStack.pop();
    }
    return _eStack.push(rv);
  },
  function () {
    return 1 - this.args[0];
  }
);

/*
 * 无条件跳转
 * */
export const JMP = createOP(OPCodeIdx.JMP, function (f) {
  return (f.ip = this.args[0]);
});
/*
 * true 跳转
 * */
export const JMPT = createOP(OPCodeIdx.JMPT, function (f, _eStack) {
  if (_eStack.pop()) {
    return (f.ip = this.args[0]);
  }
});

/*
 * false 跳转
 * */
export const JMPF = createOP(OPCodeIdx.JMPF, function (f, _eStack) {
  if (!_eStack.pop()) {
    return (f.ip = this.args[0]);
  }
});

// push function reference
export const FUNCTION = createOP(
  OPCodeIdx.FUNCTION,
  function (f, _eStack, l, r) {
    const scriptIndex = this.args[0];
    // f.script.scripts[scriptIndex]  函数的body 指令集
    return _eStack.push(createFunction(f.script.scripts[scriptIndex], l, r, this.args[1]));
  },
  () => 1
);

export const FUNCTION_SETUP = createOP(OPCodeIdx.FUNCTION_SETUP, function (f, _eStack, l) {
  // 当前栈 情况 [fn, [Arguments] { '0': 2 },]
  l.set(1, _eStack.pop());
  const fn = _eStack.pop();
  if (this.args[0]) {
    return l.set(2, fn);
  }
});

// initialize 'rest' param
export const REST = createOP(OPCodeIdx.REST, function (f, _eStack, l) {
  const index = this.args[0];
  const varIndex = this.args[1];
  const args = l.get(1);
  if (index < args.length) {
    return l.set(varIndex, Array.prototype.slice.call(args, index));
  }
});

// return from function
export const RET = createOP(OPCodeIdx.RET, function (f) {
  return ret(f);
});

// return value from Function
export const RETV = createOP(OPCodeIdx.RETV, function (f, _eStack) {
  f.fiber.rv = _eStack.pop();
  return ret(f);
});

// call as constructor
export const NEW = createOP(OPCodeIdx.NEW, function (f) {
  return call(f, this.args[0], null, true);
});

// 调用函数
export const CALL = createOP(
  OPCodeIdx.CALL,
  function (f) {
    return call(f, this.args[0], this.args[1]);
  },
  function () {
    // pop弹出 n 个参数加上函数并压入返回值
    return 1 - (this.args[0] + 1);
  }
);
// call method
export const CALLM = createOP(
  OPCodeIdx.CALLM,
  function (f) {
    return callm(f, this.args[0], null, null, this.args[1]);
  },
  function () {
    // 弹出 n 个参数加上函数加上目标并推送返回值
    return 1 - (this.args[0] + 1 + 1);
  }
);
// calls 'iterator' method
export const ITER = createOP(OPCodeIdx.ITER, function (f, _eStack) {
  return callm(f, 0, 'iterator', _eStack.pop());
});
/*
 * 产生对象的可枚举属性
 * */
export const ENUMERATE = createOP(OPCodeIdx.ENUMERATE, function (f, _eStack) {
  return _eStack.push(enumerateKeys(_eStack.pop()));
});
// calls iterator 'next'
export const NEXT = createOP(OPCodeIdx.NEXT, function (f, _eStack) {
  callm(f, 0, 'next', _eStack.pop());
  if (f.error instanceof StopIteration) {
    f.error = null;
    f.paused = false;
    return (f.ip = this.args[0]);
  }
});
// pause frame
export const PAUSE = createOP(OPCodeIdx.PAUSE, function (f) {
  return (f.paused = true);
});

// yield value from generator
export const YIELD = createOP(OPCodeIdx.YIELD, function (f, _eStack) {
  f.fiber.yielded = _eStack.pop();
  return f.fiber.pause();
});

export const THROW = createOP(OPCodeIdx.THROW, function (f, _eStack) {
  return throwErr(f, _eStack.pop());
});

export const ENTER_GUARD = createOP(OPCodeIdx.ENTER_GUARD, function (f) {
  return f.guards.push(f.script.guards[this.args[0]]);
});

export const EXIT_GUARD = createOP(OPCodeIdx.EXIT_GUARD, function (f) {
  const currentGuard = f.guards[f.guards.length - 1];
  const specifiedGuard = f.script.guards[this.args[0]];
  if (specifiedGuard === currentGuard) {
    return f.guards.pop();
  }
});

/*
 * enter nested scope
 * */
export const ENTER_SCOPE = createOP(OPCodeIdx.ENTER_SCOPE, function (frame) {
  return (frame.scp = new Scope(frame.scp, frame.script.localNames, frame.script.localLength));
});

/*
 * exit nested scope
 * */
export const EXIT_SCOPE = createOP(OPCodeIdx.EXIT_SCOPE, function (frame) {
  return (frame.scp = frame.scp!.parent);
});

/*
 * 设置行号
 * */
export const LINE = createOP(OPCodeIdx.LINE, function (frame) {
  return frame.setLine(this.args[0]);
});

/*
 * 设置列号
 * */
export const COLUMN = createOP(OPCodeIdx.COLUMN, function (frame) {
  return frame.setColumn(this.args[0]);
});

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DEBUG = createOP(OPCodeIdx.DEBUG, function (frame, _eStack, scope) {});

export const InsMap = new Map([
  [OPCodeIdx.SR1, SR1],
  [OPCodeIdx.SR2, SR2],
  [OPCodeIdx.SR3, SR3],

  [OPCodeIdx.LR1, LR1],
  [OPCodeIdx.LR2, LR2],
  [OPCodeIdx.LR3, LR3],

  [OPCodeIdx.SREXP, SREXP],

  [OPCodeIdx.LINE, LINE],
  [OPCodeIdx.COLUMN, COLUMN],

  [OPCodeIdx.GETL, GETL],
  [OPCodeIdx.SETL, SETL],

  [OPCodeIdx.POP, POP],
  [OPCodeIdx.DUP, DUP],
  [OPCodeIdx.SWAP, SWAP],

  [OPCodeIdx.GLOBAL, GLOBAL],

  [OPCodeIdx.GET, GET],
  [OPCodeIdx.SET, SET],
  [OPCodeIdx.DEL, DEL],

  [OPCodeIdx.GETG, GETG],
  [OPCodeIdx.SETG, SETG],
  [OPCodeIdx.SLHS, SLHS],
  [OPCodeIdx.LLHS, LLHS],
  [OPCodeIdx.DECLG, DECLG],

  [OPCodeIdx.PLU, PLU],
  [OPCodeIdx.INV, INV],
  [OPCodeIdx.LNOT, LNOT],
  [OPCodeIdx.NOT, NOT],
  [OPCodeIdx.INC, INC],
  [OPCodeIdx.DEC, DEC],

  [OPCodeIdx.ADD, ADD],
  [OPCodeIdx.SUB, SUB],
  [OPCodeIdx.MUL, MUL],
  [OPCodeIdx.DIV, DIV],
  [OPCodeIdx.MOD, MOD],
  [OPCodeIdx.SHL, SHL],
  [OPCodeIdx.SAR, SAR],
  [OPCodeIdx.SHR, SHR],
  [OPCodeIdx.OR, OR],
  [OPCodeIdx.AND, AND],
  [OPCodeIdx.XOR, XOR],
  [OPCodeIdx.EXP, EXP],

  [OPCodeIdx.CEQ, CEQ],
  [OPCodeIdx.CNEQ, CNEQ],
  [OPCodeIdx.CID, CID],
  [OPCodeIdx.CNID, CNID],
  [OPCodeIdx.LT, LT],
  [OPCodeIdx.LTE, LTE],

  [OPCodeIdx.GT, GT],
  [OPCodeIdx.GTE, GTE],

  [OPCodeIdx.IN, IN],
  [OPCodeIdx.INSTANCEOF, INSTANCEOF],
  [OPCodeIdx.TYPEOF, TYPEOF],
  [OPCodeIdx.VOID, VOID],

  [OPCodeIdx.UNDEF, UNDEF],

  [OPCodeIdx.LITERAL, LITERAL],
  [OPCodeIdx.STRING_LITERAL, STRING_LITERAL],
  [OPCodeIdx.REGEXP_LITERAL, REGEXP_LITERAL],
  [OPCodeIdx.OBJECT_LITERAL, OBJECT_LITERAL],
  [OPCodeIdx.ARRAY_LITERAL, ARRAY_LITERAL],

  [OPCodeIdx.ITER, ITER],
  [OPCodeIdx.ENUMERATE, ENUMERATE],
  [OPCodeIdx.NEXT, NEXT],

  [OPCodeIdx.JMP, JMP],
  [OPCodeIdx.JMPT, JMPT],
  [OPCodeIdx.JMPF, JMPF],

  [OPCodeIdx.FUNCTION_SETUP, FUNCTION_SETUP],
  [OPCodeIdx.FUNCTION, FUNCTION],
  [OPCodeIdx.REST, REST],
  [OPCodeIdx.RET, RET],
  [OPCodeIdx.RETV, RETV],
  [OPCodeIdx.NEW, NEW],
  [OPCodeIdx.CALL, CALL],
  [OPCodeIdx.CALLM, CALLM],
  [OPCodeIdx.PAUSE, PAUSE],
  [OPCodeIdx.YIELD, YIELD],
  [OPCodeIdx.THROW, THROW],
  [OPCodeIdx.ENTER_GUARD, ENTER_GUARD],
  [OPCodeIdx.EXIT_GUARD, EXIT_GUARD],

  [OPCodeIdx.ENTER_SCOPE, ENTER_SCOPE],
  [OPCodeIdx.EXIT_SCOPE, EXIT_SCOPE],

  [OPCodeIdx.DEBUG, DEBUG],
]);
