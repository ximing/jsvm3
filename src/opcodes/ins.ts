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
  get,
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
  sar,
  set,
  shl,
  shr,
  sub,
  xor,
} from './op';
import { createOP } from './utils';

/*
 * 存储到寄存器1
 * */
export const SR1 = createOP(
  'SR1',
  function (frame, stack) {
    return (frame.fiber.r1 = stack.pop());
  },
  () => 0
);
export const SR2 = createOP('SR2', function (frame, stack) {
  return (frame.fiber.r2 = stack.pop());
});
export const SR3 = createOP('SR3', function (frame, stack) {
  return (frame.fiber.r3 = stack.pop());
});
/*
 * 从寄存器1读取
 * */
export const LR1 = createOP(
  'LR1',
  function (frame, stack) {
    return stack.push(frame.fiber.r1);
  },
  () => 1
);
export const LR2 = createOP(
  'LR2',
  function (frame, stack) {
    return stack.push(frame.fiber.r2);
  },
  () => 1
);
export const LR3 = createOP(
  'LR3',
  function (frame, stack) {
    return stack.push(frame.fiber.r3);
  },
  () => 1
);
/*
 * 存储到表达式寄存器
 * */
export const SREXP = createOP('SREXP', function (frame, stack) {
  return (stack.fiber.rexp = stack.pop());
});

export const POP = createOP('POP', function (frame, stack) {
  return stack.pop();
});

export const DUP = createOP(
  'DUP',
  function (frame, stack) {
    return stack.push(stack.top());
  },
  () => 1
);

export const SWAP = createOP('SWAP', function (frame, stack) {
  const top = stack.pop();
  const bot = stack.pop();
  stack.push(top);
  return stack.push(bot);
});

export const ENTER_GUARD = createOP('ENTER_GUARD', function (f) {
  return f.guards.push(f.script.guards[this.args[0]]);
});
export const EXIT_GUARD = createOP('EXIT_GUARD', function (f) {
  const currentGuard = f.guards[f.guards.length - 1];
  const specifiedGuard = f.script.guards[this.args[0]];
  if (specifiedGuard === currentGuard) {
    return f.guards.pop();
  }
});

export const GLOBAL = createOP(
  'GLOBAL',
  function (f, s, l, r) {
    return s.push(r.global);
  },
  () => 1
);
/*
 * 从对象中获取属性
 * */
export const GET = createOP('GET', function (frame, stack) {
  const obj = stack.pop();
  const key = stack.pop();
  if (obj == null) {
    return throwErr(frame, new XYZTypeError("[XYZ] Cannot read property '" + key + "' of " + obj));
  }
  return stack.push(get(obj, key));
});

/*
 * 设置对象属性
 * */
export const SET = createOP('SET', function (frame, stack) {
  const obj = stack.pop();
  const key = stack.pop();
  const val = stack.pop();
  if (obj == null) {
    return throwErr(frame, new XYZTypeError("Cannot set property '" + key + "' of " + obj));
  }
  return stack.push(set(obj, key, val));
});

/*
 * 删除对象属性
 * */
export const DEL = createOP('DEL', function (frame, stack) {
  const obj = stack.pop();
  const key = stack.pop();
  if (obj == null) {
    return throwErr(frame, new XYZTypeError('Cannot convert null to object'));
  }
  return stack.push(del(obj, key));
});

/*
 * 获取局部变量
 * */
export const GETL = createOP(
  'GETL',
  function (frame, stack, s) {
    let scopeIndex = this.args[0];
    const varIndex = this.args[1];
    let scope = s;
    while (scopeIndex--) {
      scope = scope.parent!;
    }
    return stack.push(scope.get(varIndex));
  },
  () => 1
);

/*
 * 设置局部变量
 * */
export const SETL = createOP('SETL', function (frame, stack, s) {
  let scopeIndex = this.args[0];
  const varIndex = this.args[1];
  let scope = s;
  while (scopeIndex--) {
    scope = scope.parent!;
  }
  return stack.push(scope.set(varIndex, stack.pop()));
});

/*
 * 获取全局变量
 * */
export const GETG = createOP(
  'GETG',
  function (frame, stack, scope, realm) {
    if (!hasProp(realm.global, this.args[0]) && !this.args[1]) {
      return throwErr(frame, new XYZReferenceError('' + this.args[0] + ' is not defined'));
    }
    return stack.push(realm.global[this.args[0]]);
  },
  () => 1
);

/*
 * 设置全局变量
 * */
export const SETG = createOP('SETG', function (frame, stack, scope, realm) {
  return stack.push((realm.global[this.args[0]] = stack.pop()));
});

/*
 * invert signal
 * */
export const INV = createOP('INV', function (f, s) {
  return s.push(inv(s.pop()));
});

/*
 * logical NOT
 * */
export const LNOT = createOP('LNOT', function (f, s) {
  return s.push(lnot(s.pop()));
});

/*
 * bitwise NOT
 * */
export const NOT = createOP('NOT', function (f, s) {
  return s.push(not(s.pop()));
});

/*
 * increment
 * */
export const INC = createOP('INC', function (f, s) {
  return s.push(inc(s.pop()));
});

/*
 * decrement
 * */
export const DEC = createOP('DEC', function (f, s) {
  return s.push(dec(s.pop()));
});

/*
 * sum
 * */
export const ADD = createOP('ADD', function (f, s) {
  return s.push(add(s.pop(), s.pop()));
});
export const SUB = createOP('SUB', function (f, s) {
  return s.push(sub(s.pop(), s.pop()));
});
export const MUL = createOP('MUL', function (f, s) {
  return s.push(mul(s.pop(), s.pop()));
});
export const DIV = createOP('DIV', function (f, s) {
  return s.push(div(s.pop(), s.pop()));
});

export const MOD = createOP('MOD', function (f, s) {
  return s.push(mod(s.pop(), s.pop()));
});

// left shift
export const SHL = createOP('SHL', function (f, s) {
  return s.push(shl(s.pop(), s.pop()));
});
// right shift
export const SAR = createOP('SAR', function (f, s) {
  return s.push(sar(s.pop(), s.pop()));
});
// unsigned shift
export const SHR = createOP('SHR', function (f, s) {
  return s.push(shr(s.pop(), s.pop()));
});

export const OR = createOP('OR', function (f, s) {
  return s.push(or(s.pop(), s.pop()));
});
export const AND = createOP('AND', function (f, s) {
  return s.push(and(s.pop(), s.pop()));
});
// bitwise XOR
export const XOR = createOP('XOR', function (f, s) {
  return s.push(xor(s.pop(), s.pop()));
});

export const CEQ = createOP('CEQ', function (f, s) {
  return s.push(ceq(s.pop(), s.pop()));
});
export const CNEQ = createOP('CNEQ', function (f, s) {
  return s.push(cneq(s.pop(), s.pop()));
});
export const CID = createOP('CID', function (f, s) {
  return s.push(cid(s.pop(), s.pop()));
});
export const CNID = createOP('CNID', function (f, s) {
  return s.push(cnid(s.pop(), s.pop()));
});
export const LT = createOP('LT', function (f, s) {
  return s.push(lt(s.pop(), s.pop()));
});
export const LTE = createOP('LTE', function (f, s) {
  return s.push(lte(s.pop(), s.pop()));
});
export const GT = createOP('GT', function (f, s) {
  return s.push(gt(s.pop(), s.pop()));
});
export const GTE = createOP('GTE', function (f, s) {
  return s.push(gte(s.pop(), s.pop()));
});
export const IN = createOP('IN', function (f, s) {
  return s.push(has(s.pop(), s.pop()));
});
export const INSTANCEOF = createOP('INSTANCEOF', function (f, s) {
  return s.push(instanceOf(s.pop(), s.pop()));
});
export const TYPEOF = createOP('TYPEOF', function (f, s) {
  return s.push(typeof s.pop());
});
export const VOID = createOP('VOID', function (f, s) {
  s.pop();
  // eslint-disable-next-line no-void
  return s.push(void 0);
});

export const UNDEF = createOP(
  'UNDEF',
  function (f, s) {
    // eslint-disable-next-line no-void
    return s.push(void 0);
  },
  () => 1
);

// push 字面值
export const LITERAL = createOP(
  'LITERAL',
  function (f, s) {
    return s.push(this.args[0]);
  },
  () => 1
);

export const STRING_LITERAL = createOP(
  'STRING_LITERAL',
  function (f, s) {
    return s.push(f.script.strings[this.args[0]]);
  },
  () => 1
);

export const REGEXP_LITERAL = createOP(
  'REGEXP_LITERAL',
  function (f, s) {
    return s.push(f.script.regexps[this.args[0]]);
  },
  () => 1
);

export const OBJECT_LITERAL = createOP(
  'OBJECT_LITERAL',
  function (f, s) {
    let length = this.args[0];
    const rv = {};
    while (length--) {
      set(rv, s.pop(), s.pop());
    }
    return s.push(rv);
  },
  function () {
    return 1 - this.args[0] * 2;
  }
);
export const ARRAY_LITERAL = createOP(
  'ARRAY_LITERAL',
  function (frame, stack) {
    let length = this.args[0];
    const rv = new Array(length);
    while (length--) {
      rv[length] = stack.pop();
    }
    return stack.push(rv);
  },
  function () {
    return 1 - this.args[0];
  }
);

/*
 * enter nested scope
 * */
export const ENTER_SCOPE = createOP('ENTER_SCOPE', function (frame) {
  return (frame.scope = new Scope(frame.scope, frame.script.localNames, frame.script.localLength));
});

/*
 * exit nested scope
 * */
export const EXIT_SCOPE = createOP('EXIT_SCOPE', function (frame) {
  return (frame.scope = frame.scope!.parent);
});

/*
 * 设置行号
 * */
export const LINE = createOP('LINE', function (frame) {
  return frame.setLine(this.args[0]);
});

/*
 * 设置列号
 * */
export const COLUMN = createOP('COLUMN', function (frame) {
  return frame.setColumn(this.args[0]);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DEBUG = createOP('DEBUG', function (frame, stack, scope) {});
