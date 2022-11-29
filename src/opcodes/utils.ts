import { OPCodeIdx } from './opIdx';
import { Label } from './label';
import { Instruction, OPExec } from './types';
import { Fiber } from '../vm/fiber';
import { XYZError, XYZTypeError } from '../utils/errors';
import { StopIteration } from '../vm/builtin';
import { Script } from '../vm/script';
import { Scope } from '../vm/scope';
import { Realm } from '../vm/realm';
import { defProp, hasProp } from '../utils/helper';
import { throwErr } from '../utils/opcodes';
import type { Frame } from '../vm/frame';
import { get } from './op';

export const createOP = function (
  name,
  fn: OPExec,
  // eslint-disable-next-line @typescript-eslint/ban-types
  calculateFactor?: Function
) {
  const base = {
    name,
    id: OPCodeIdx[name],
    exec: fn,
    calculateFactor,
    forEachLabel(cb) {
      if (this.args) {
        const result = [];
        for (let i = 0, end = this.args.length; i < end; i++) {
          if (this.args[i] instanceof Label) {
            // @ts-ignore
            result.push((this.args[i] = cb(this.args[i])));
          } else {
            // @ts-ignore
            result.push(undefined);
          }
        }
        return result;
      }
    },
  };
  if (!calculateFactor) {
    // base.factor = calculateOpcodeFactor(fn);
    // base.calculateFactor = function () {
    //   return this.factor;
    // };
    base.calculateFactor = function () {
      return 0;
    };
  }
  return (args: any) => Object.assign({ args }, base) as Instruction;
};

const createGenerator = function (caller, script, scope, realm, target, args, fn, callname) {
  let timeout;
  if (caller) {
    ({ timeout } = caller);
  }
  const fiber = new Fiber(realm, timeout);
  let frame = fiber.pushFrame(script, target, scope, args, fn, callname, false);
  let newborn = true;

  const send = function (obj) {
    if (newborn && obj !== undefined) {
      throw new XYZTypeError('no argument must be passed when starting generator');
    }
    if (fiber.done()) {
      throw new XYZError('generator closed');
    }
    frame = fiber.callStack[fiber.depth];
    if (newborn) {
      newborn = false;
      fiber.run();
    } else {
      frame!.evalStack.push(obj);
      fiber.resume();
    }
    if (caller) {
      // transfer timeout back to the caller fiber
      caller.timeout = fiber.timeout;
    }
    if (fiber.done()) {
      rv.closed = true;
      throw new StopIteration(fiber.rv, 'generator has stopped');
    }
    return fiber.yielded;
  };

  const thrw = function (e) {
    if (newborn) {
      close();
      return e;
    }
    if (fiber.done()) {
      throw new XYZError('generator closed');
    }
    frame = fiber.callStack[fiber.depth];
    frame!.error = e;
    fiber.resume();
    if (caller) {
      caller.timeout = fiber.timeout;
    }
    if (fiber.done()) {
      return fiber.rv;
    }
    return fiber.yielded;
  };

  const close = function () {
    if (fiber.done()) {
      return;
    }
    if (newborn) {
      fiber.depth = -1;
    }
    // force a return
    frame = fiber.callStack[fiber.depth];
    frame!.evalStack.clear();
    frame!.ip = frame!.exitIp;
    fiber.resume();
    if (caller) {
      caller.timeout = fiber.timeout;
    }
    return fiber.rv;
  };

  const rv = {
    next: send,
    send,
    throw: thrw,
    close,
    closed: false,
    iterator() {
      return rv;
    },
  };

  return rv;
};

export const createFunction = function (
  script: Script,
  scope: Scope | null,
  realm: Realm,
  generator = false
) {
  let fun;
  if (generator) {
    fun = function () {
      let fiber;
      const name = fun.__callname__ || script.name;
      const gen = createGenerator(fun.__fiber__, script, scope, realm, this, arguments, fun, name);
      if (!(fiber = fun.__fiber__)) {
        return gen;
      }
      fiber.callStack[fiber.depth].evalStack.push(gen);
      fun.__fiber__ = null;
      return (fun.__callname__ = null);
    };
  } else {
    fun = function () {
      let construct, fiber: Fiber;
      let run = false;
      if ((fiber = fun.__fiber__)) {
        fiber.callStack[fiber.depth].paused = true;
        fun.__fiber__ = null;
        construct = fun.__construct__;
        fun.__construct__ = null;
      } else {
        fiber = new Fiber(realm);
        run = true;
      }
      const name = fun.__callname__ || script.name;
      fun.__callname__ = null;
      // console.log('arguments', arguments);
      fiber.pushFrame(script, this, scope, arguments, fun, name, construct);
      if (run) {
        fiber.run();
        return fiber.rv;
      }
    };
  }
  console.log(script);
  defProp(fun, '__xyzFunction__', { value: true });
  defProp(fun, 'length', { value: script.paramsSize });
  defProp(fun, '__source__', { value: script.source });
  defProp(fun, '__name__', { value: script.name });
  defProp(fun, 'name', { value: script.name });
  defProp(fun, '__construct__', { value: null, writable: true });
  defProp(fun, '__fiber__', { value: null, writable: true });
  defProp(fun, '__callname__', { value: null, writable: true });
  return fun;
};

export const ret = function (frame) {
  frame.evalStack.clear();
  return (frame.exitIp = frame.ip);
};

const callDateConstructor = function (a) {
  let rv;
  switch (a.length) {
    case 0:
      rv = new Date();
      break;
    case 1:
      rv = new Date(a[0]);
      break;
    case 2:
      rv = new Date(a[0], a[1]);
      break;
    case 3:
      rv = new Date(a[0], a[1], a[2]);
      break;
    case 4:
      rv = new Date(a[0], a[1], a[2], a[3]);
      break;
    case 5:
      rv = new Date(a[0], a[1], a[2], a[3], a[4]);
      break;
    case 6:
      rv = new Date(a[0], a[1], a[2], a[3], a[4], a[5]);
      break;
    default:
      rv = new Date(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
  }
  return rv;
};

const callArrayConstructor = function (a) {
  if (a.length === 1 && (a[0] | 0) === a[0]) {
    return new Array(a[0]);
  }
  return a.slice();
};

const callRegExpConstructor = function (a) {
  if (a.length === 1) {
    return new RegExp(a[0]);
  } else {
    return new RegExp(a[0], a[1]);
  }
};

const createNativeInstance = function (constructor, args) {
  if (constructor === Date) {
    return callDateConstructor(args);
  } else if (constructor === Array) {
    return callArrayConstructor(args);
  } else if (constructor === RegExp) {
    return callRegExpConstructor(args);
  } else if (constructor === Number) {
    return Number(args[0]);
  } else if (constructor === Boolean) {
    return Boolean(args[0]);
  } else {
    // create a new object linked to the function prototype by using
    // a constructor proxy
    const constructorProxy = function () {
      return constructor.apply(this, args);
    };
    constructorProxy.prototype = constructor.prototype;
    // @ts-ignore
    const rv = new constructorProxy();
    return rv;
  }
};

export const call = function (
  frame: Frame,
  length: number,
  func: any,
  target: any,
  name: string | null,
  construct?
) {
  if (typeof func !== 'function') {
    return throwErr(frame, new XYZTypeError(`${name || 'object'} is not a function`));
  }
  const { evalStack: stack, fiber, realm } = frame;
  let args = { length, callee: func };
  while (length) {
    args[--length] = stack.pop();
  }
  // "" 字符串情况 @TODO 严格模式？
  if (target == null) {
    target = realm.global;
  }
  let push = true;
  args = Array.prototype.slice.call(args);
  if (hasProp(func, '__xyzFunction__')) {
    func.__callname__ = name;
    func.__fiber__ = fiber;
    func.__construct__ = construct;
    push = false;
  }
  try {
    let val;
    if (construct) {
      // create a native class instance
      val = createNativeInstance(func, args);
    } else {
      val = func.apply(target, args);
    }
    if (push && !fiber.paused) {
      return stack.push(val);
    }
  } catch (nativeError) {
    return throwErr(frame, nativeError);
  }
};

export const callm = function (
  frame: Frame,
  length: number,
  key: string,
  target?: any,
  name?: string | null
) {
  const { evalStack: stack } = frame;
  if (target == null) {
    let id = 'null';
    if (target === undefined) {
      id = 'undefined';
    }
    return throwErr(frame, new XYZTypeError(`Cannot call method '${key}' of ${id}`));
  }
  const { constructor } = target;
  const targetName = constructor.__name__ || constructor.name || 'Object';
  name = `${targetName}.${name}`;
  const func = get(target, key);
  if (func instanceof Function) {
    return call(frame, length, func, target, name);
  }
  if (func == null) {
    stack.pop(); // pop target
    return throwErr(frame, new XYZTypeError(`Object #<${name}> has no method '${key}'`));
  } else {
    stack.pop(); // pop target
    return throwErr(
      frame,
      new XYZTypeError(`Property '${key}' of object #<${name}> is not a function`)
    );
  }
};
