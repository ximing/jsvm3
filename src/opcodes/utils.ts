import { Instruction, OPExec } from './types';
import { Fiber } from '../vm/fiber';
import { XYZTypeError } from '../utils/errors';
import { Script } from '../vm/script';
import { Scope } from '../vm/scope';
import { Realm } from '../vm/realm';
import { defProp, hasProp } from '../utils/helper';
import { throwErr } from '../utils/opcodes';
import type { Frame } from '../vm/frame';
import { get } from './op';
import { EvaluationStack } from '../vm/stack';
import { InsMap } from './ins';
// @ifdef COMPILER
import { OPCodeIdx } from './opIdx';
import { Label } from './label';
import { Cannot } from './contants';

const OPCodeMap: any = Object.keys(OPCodeIdx).reduce((total: any, cur: string) => {
  total[OPCodeIdx[cur]] = cur;
  return total;
}, {});
// @endif

export const createOP = function (
  id: number,
  fn: OPExec,
  calculateFactor?: (this: Instruction) => number
) {
  // @ts-ignore
  const base: Instruction = {
    // runtime
    id,
    exec: fn,
    // runtime end
    // @ifdef COMPILER
    name: OPCodeMap[id],
    calculateFactor:
      calculateFactor ||
      function () {
        return 0;
      },
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
    // @endif
  };
  InsMap.set(id, base);
  return (args: any) => Object.assign({ args }, base) as Instruction;
};

// const createGenerator = function (caller, script, scope, realm, target, args, fn, callname) {
//   let timeout;
//   if (caller) {
//     ({ timeout } = caller);
//   }
//   const fiber = new Fiber(realm, timeout);
//   let frame = fiber.pushFrame(script, target, scope, args, fn, callname, false);
//   let newborn = true;
//
//   const send = function (obj) {
//     if (newborn && obj !== undefined) {
//       throw new XYZTypeError('no argument must be passed when starting generator');
//     }
//     if (fiber.done()) {
//       throw new XYZError('generator closed');
//     }
//     frame = fiber.callStack[fiber.depth];
//     if (newborn) {
//       newborn = false;
//       fiber.run();
//     } else {
//       frame!.evalStack.push(obj);
//       fiber.resume();
//     }
//     if (caller) {
//       // transfer timeout back to the caller fiber
//       caller.timeout = fiber.timeout;
//     }
//     if (fiber.done()) {
//       rv.closed = true;
//       throw new StopIteration(fiber.rv, 'generator has stopped');
//     }
//     return fiber.yielded;
//   };
//
//   const thrw = function (e) {
//     if (newborn) {
//       close();
//       return e;
//     }
//     if (fiber.done()) {
//       throw new XYZError('generator closed');
//     }
//     frame = fiber.callStack[fiber.depth];
//     frame!.evalError = e;
//     fiber.resume();
//     if (caller) {
//       caller.timeout = fiber.timeout;
//     }
//     if (fiber.done()) {
//       return fiber.rv;
//     }
//     return fiber.yielded;
//   };
//
//   const close = function () {
//     if (fiber.done()) {
//       return;
//     }
//     if (newborn) {
//       fiber.depth = -1;
//     }
//     // force a return
//     frame = fiber.callStack[fiber.depth];
//     frame!.evalStack.clear();
//     frame!.ip = frame!.exitIp;
//     fiber.resume();
//     if (caller) {
//       caller.timeout = fiber.timeout;
//     }
//     return fiber.rv;
//   };
//
//   const rv = {
//     next: send,
//     send,
//     throw: thrw,
//     close,
//     closed: false,
//     iterator() {
//       return rv;
//     },
//   };
//
//   return rv;
// };

export const createFunction = function (
  script: Script,
  scope: Scope | null,
  realm: Realm,
  generator = false
) {
  let fun;
  if (generator) {
    throw new Error('*fun not work');
    // fun = function (this: any) {
    //   let fiber;
    //   const name = fun.__cname__ || script.name;
    //   const gen = createGenerator(fun.__fiber__, script, scope, realm, this, arguments, fun, name);
    //   if (!(fiber = fun.__fiber__)) {
    //     return gen;
    //   }
    //   fiber.callStack[fiber.depth].evalStack.push(gen);
    //   fun.__fiber__ = null;
    //   return (fun.__cname__ = null);
    // };
  } else {
    fun = function (this: any) {
      let construct, fiber: Fiber;
      let run = false;
      if ((fiber = fun.__fiber__)) {
        // callStack
        fiber.callStack[fiber.depth].suspended = true;
        fun.__fiber__ = null;
        construct = fun.__con__;
        fun.__con__ = null;
      } else {
        fiber = new Fiber(realm);
        run = true;
      }
      const name = fun.__cname__ || script.name;
      fun.__cname__ = null;
      // console.log('arguments', arguments, name);
      fiber.pushFrame(script, this, scope, arguments, fun, name, construct);
      if (run) {
        fiber.run();
        return fiber.rv;
      }
    };
  }
  defProp(fun, '__xyzFun__', { value: true });
  defProp(fun, 'length', { value: script.paramsSize });
  // @ifdef COMPILER
  defProp(fun, '__source__', { value: script.source });
  // @endif
  defProp(fun, '__name__', { value: script.name });
  defProp(fun, 'name', { value: script.name });
  defProp(fun, '__con__', { value: null, writable: true });
  defProp(fun, '__fiber__', { value: null, writable: true });
  defProp(fun, '__cname__', { value: null, writable: true });
  return fun;
};

export const ret = function (frame: Frame) {
  frame.evalStack.clear();
  return (frame.exitIp = frame.ip);
};
//
// // https://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
// const callDateConstructor = function (a: any[]) {
//   // @ts-ignore
//   return new Date(...a);
// };
//
// const callArrayConstructor = function (a) {
//   if (a.length === 1 && (a[0] | 0) === a[0]) {
//     return new Array(a[0]);
//   }
//   return a.slice();
// };
//
// const callRegExpConstructor = function (a) {
//   if (a.length === 1) {
//     return new RegExp(a[0]);
//   } else {
//     return new RegExp(a[0], a[1]);
//   }
// };

const createNativeInstance = function (constructor, args) {
  return new constructor(...args);

  // if (constructor === Date) {
  //   return callDateConstructor(args);
  // } else if (constructor === Array) {
  //   return callArrayConstructor(args);
  // } else if (constructor === RegExp) {
  //   return callRegExpConstructor(args);
  // } else if (constructor === Number) {
  //   return Number(args[0]);
  // } else if (constructor === Boolean) {
  //   return Boolean(args[0]);
  // } else {
  //   return new constructor(...args);
  //   // // create a new object linked to the function prototype by using
  //   // // a constructor proxy
  //   // const constructorProxy = function () {
  //   //   return constructor.apply(this, args);
  //   // };
  //   // constructorProxy.prototype = constructor.prototype;
  //   // // @ts-ignore
  //   // const rv = new constructorProxy();
  //   // return rv;
  // }
};

export const getParams = function (length: number, evalStack: EvaluationStack) {
  // const args: any = { length };
  // while (length) {
  //   args[--length] = evalStack.pop();
  // }
  const args = evalStack.tail(length);
  args.length = length;
  return args;
};

export const callFun = function (frame, func, args, target, name, construct = false) {
  const { evalStack, fiber, realm } = frame;
  if (typeof func !== 'function') {
    return throwErr(frame, new XYZTypeError(`${name || 'obj'} is not a function`));
  }
  // "" 字符串情况 @TODO 严格模式？
  if (target == null) {
    target = realm.global;
  }
  let push = true;
  // args = Array.prototype.slice.call(args);
  if (hasProp(func, '__xyzFun__')) {
    func.__cname__ = name;
    func.__fiber__ = fiber;
    func.__con__ = construct;
    push = false;
  }
  try {
    let val;
    if (construct) {
      // create a native class instance
      val = createNativeInstance(func, args);
    } else {
      // console.log('call---->', func, target, args);
      val = func.apply(target, args);
    }
    if (push && !fiber.suspended) {
      return evalStack.push(val);
    }
  } catch (nativeError) {
    return throwErr(frame, nativeError);
  }
};

export const call = function (frame: Frame, length: number, name: string | null, construct?) {
  const { evalStack } = frame;
  const args: any = getParams(length, evalStack);
  const func = evalStack.pop();
  args.callee = func;
  return callFun(frame, func, args, null, name, construct);
};

export const callm = function (
  frame: Frame,
  length: number,
  key: string | null,
  target?: any,
  name?: string | null
) {
  const { evalStack } = frame;
  const args = getParams(length, evalStack);
  if (!key) {
    key = evalStack.pop();
    target = evalStack.pop();
  }
  if (target == null) {
    let id = 'null';
    if (target === undefined) {
      id = 'undefined';
    }
    return throwErr(frame, new XYZTypeError(`${Cannot} cal method '${key}' of ${id}`));
  }
  const { constructor } = target;
  const targetName = constructor.__name__ || constructor.name || 'Object';
  name = `${targetName}.${name}`;
  const func = get(target, key);
  if (func instanceof Function) {
    return callFun(frame, func, args, target, name);
    // return call(frame, length, func, target, name);
  }
  if (func == null) {
    // stack.pop(); // pop target
    return throwErr(frame, new XYZTypeError(`Object #<${name}> has no fun '${key}'`));
  } else {
    // stack.pop(); // pop target
    return throwErr(frame, new XYZTypeError(`'${key}' of object #<${name}> is not a function`));
  }
};
