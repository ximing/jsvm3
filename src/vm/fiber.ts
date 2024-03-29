import { Frame } from './frame';
import { Scope } from './scope';
import { Trace } from './types';
import { isArray } from '../utils/helper';
import { Realm } from './realm';
import { JSVMError, JSVMTimeoutError } from '../utils/errors';
import { Script } from './script';

/*
 * 在 JavaScript 中，Fiber 是用于实现协程（Coroutine）的一种机制，它可以让我们编写非阻塞的异步代码。
 * 每个 Fiber 可以看作是一个轻量级的线程，它们在同一个线程中并行运行，但只有一个 Fiber 可以在任何给定的时间点运行。
 * Fiber 可以将执行权交给其他 Fiber，这样可以实现非阻塞的 I/O 或计算操作。
 * */
export class Fiber {
  realm: Realm;
  r1: any;
  r2: any;
  r3: any;
  rexp: any;
  timeout: number;
  maxDepth: number;
  maxTraceDepth: number;
  // callStack
  callStack: any[];
  evalStack: any;
  depth: number;
  rv: any;
  yielded: any;
  suspended: boolean;
  insMap = new Map();

  constructor(realm: Realm, timeout = -1) {
    const t = this;
    t.realm = realm;
    t.timeout = timeout;
    t.maxDepth = 1000;
    t.maxTraceDepth = 50;
    t.callStack = [];
    t.evalStack = null;
    t.depth = -1;
    t.yielded = t.rv = undefined;
    t.suspended = false;
    // fiber-specific registers temporary registers
    t.r1 = t.r2 = t.r3 = null;
    // expression register(last evaluated expression statement)
    t.rexp = null;
  }

  run() {
    let frame: Frame = this.callStack[this.depth];
    let err = frame.evalError;
    while (this.depth >= 0 && frame && !this.suspended) {
      if (err) {
        frame = this.unwind(err);
      }
      frame.run();
      if ((err = frame.evalError) instanceof JSVMError) {
        this.injectStackTrace(err);
      }
      if (frame.isDone()) {
        if (frame.guards.length) {
          const guard = frame.guards.pop();
          // @ts-ignore
          if (guard.finalizer) {
            // we returned in the middle of a 'try' statement.
            // if there's a finalizer, it be executed before returning
            // @ts-ignore
            frame.ip = guard.finalizer;
            // @ts-ignore
            frame.exitIp = guard.end;
            frame.suspended = false;
            continue;
          }
        }
      } else {
        // 可能是函数调用，确保“frame”指向顶部
        frame = this.callStack[this.depth];
        err = frame.evalError;
        continue;
      }
      // 返回的函数，检查这是否是构造函数调用并采取相应措施
      if (frame.construct) {
        if (!['object', 'function'].includes(typeof this.rv)) {
          this.rv = frame.getScope()!.get(0); // return this
        }
      }
      frame = this.popFrame();
      if (frame && !err) {
        // set the return value
        frame.evalStack.push(this.rv);
        this.rv = undefined;
      }
    }
    if (this.timedOut()) {
      err = new JSVMTimeoutError(this);
      this.injectStackTrace(err);
    }
    if (err) {
      // console.trace();
      throw err;
    }
  }

  unwind(err) {
    // 展开调用堆栈以寻找 guard
    let frame: Frame = this.callStack[this.depth];
    while (frame) {
      let len;
      // 确保错误出现在栈帧上
      frame.evalError = err;
      // ip 总是指向下一条指令，所以减去一条
      const ip = frame.ip - 1;
      if ((len = frame.guards.length)) {
        const guard = frame.guards[len - 1];
        // @ts-ignore
        if (guard.start <= ip && ip <= guard.end) {
          if (guard.handler !== null) {
            // try/catch
            if (ip <= guard.handler) {
              // 扔到保护区内
              frame.evalStack.push(err);
              frame.evalError = null;
              // @ts-ignore
              frame.ip = guard.handler;
            } else {
              // 扔到保护区外(eg: catch or finally block)
              if (guard.finalizer && frame.ip <= guard.finalizer) {
                // 有一个 finally 块，它被扔进了 catch 块，确保执行
                // @ts-ignore
                frame.ip = guard.finalizer;
              } else {
                frame = this.popFrame();
                continue;
              }
            }
          } else {
            // try/finally
            // @ts-ignore
            frame.ip = guard.finalizer;
          }
          frame.suspended = false;
          return frame;
        }
      }
      frame = this.popFrame();
    }
    // console.log('throw error');
    throw err;
  }

  injectStackTrace(err: JSVMError) {
    const trace: Trace[] = [];
    let minDepth = 0;
    if (this.depth > this.maxTraceDepth) {
      minDepth = this.depth - this.maxTraceDepth;
    }
    for (let i = this.depth, end = minDepth; i >= end; i--) {
      const frame: Frame = this.callStack[i];
      let { name } = frame.script;
      if (name === '<a>' && frame.fName) {
        name = frame.fName;
      }
      trace.push({
        at: {
          name,
          fName: frame.script.fName,
        },
        line: frame.line,
        column: frame.column,
      });
    }
    if (err._trace) {
      let t: any = err._trace;
      // error was rethrown, inject the current trace at the end of
      // the leaf trace
      while (isArray(t[t.length - 1])) {
        t = t[t.length - 1];
      }
      t.push(trace);
    } else {
      err._trace = trace;
    }
    // show stack trace on node.js
    // @ts-ignore
    return (err.stack = err.toString());
  }

  // <a>
  pushFrame(
    script: Script,
    globalObj: any,
    parent: Scope | null = null,
    args: any = null,
    self: any = null,
    name = '<s>',
    construct = false
  ) {
    if (!this.checkCallStack()) {
      return;
    }
    const scope = new Scope(parent, script.localNames, script.localLength);
    // 设置 顶部对象 首次运行的时候是  global对象
    scope.set(0, globalObj);
    const frame = new Frame(this, script, scope, this.realm, name, construct);
    if (self) {
      frame.evalStack.push(self);
    }
    if (args) {
      frame.evalStack.push(args);
    }
    this.callStack[++this.depth] = frame;
    return frame;
  }

  checkCallStack() {
    if (this.depth === this.maxDepth) {
      this.callStack[this.depth].evalError = new JSVMError('maximum cStack size.');
      this.suspend();
      return false;
    }
    return true;
  }

  popFrame() {
    const frame = this.callStack[--this.depth];
    if (frame) {
      frame.suspended = false;
    }
    return frame;
  }

  suspend() {
    // eslint-disable-next-line no-return-assign
    return (this.suspended = this.callStack[this.depth].suspended = true);
  }

  resume(timeout = -1) {
    this.timeout = timeout;
    this.suspended = false;
    const frame = this.callStack[this.depth];
    frame.suspended = false;
    // const { evalStack } = this.callStack[0];
    this.run();
    if (!this.suspended) {
      return this.rexp;
    }
  }

  timedOut() {
    return this.timeout === 0;
  }

  isDone() {
    return this.depth === -1;
  }
}
