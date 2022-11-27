import { Frame } from './frame';
import { Scope } from './scope';
import { Trace } from './types';
import { isArray } from '../utils/helper';
import { Realm } from './realm';
import { XYZError, XYZTimeoutError } from '../utils/errors';

export class Fiber {
  realm: Realm;
  r1: any;
  r2: any;
  r3: any;
  rexp: any;
  timeout: number;
  maxDepth: number;
  maxTraceDepth: number;
  callStack: any[];
  evalStack: any;
  depth: number;
  rv: any;
  yielded: any;
  paused: boolean;

  constructor(realm, timeout) {
    this.realm = realm;
    if (timeout == null) {
      timeout = -1;
    }
    this.timeout = timeout;
    this.maxDepth = 1000;
    this.maxTraceDepth = 50;
    this.callStack = [];
    this.evalStack = null;
    this.depth = -1;
    this.yielded = this.rv = undefined;
    this.paused = false;
    // fiber-specific registers
    // temporary registers
    this.r1 = this.r2 = this.r3 = null;
    // expression register(last evaluated expression statement)
    this.rexp = null;
  }

  run() {
    let frame = this.callStack[this.depth];
    let err = frame.error;
    while (this.depth >= 0 && frame && !this.paused) {
      if (err) {
        frame = this.unwind(err);
      }
      frame.run();
      if ((err = frame.error) instanceof XYZError) {
        this.injectStackTrace(err);
      }
      if (frame.done()) {
        if (frame.guards.length) {
          const guard = frame.guards.pop();
          if (guard.finalizer) {
            // we returned in the middle of a 'try' statement.
            // if there's a finalizer, it be executed before returning
            frame.ip = guard.finalizer;
            frame.exitIp = guard.end;
            frame.paused = false;
            continue;
          }
        }
      } else {
        // possibly a function call, ensure 'frame' is pointing to the top
        frame = this.callStack[this.depth];
        err = frame.error;
        continue;
      }
      // function returned, check if this was a constructor invocation
      // and act accordingly
      if (frame.construct) {
        if (!['object', 'function'].includes(typeof this.rv)) {
          this.rv = frame.scope.get(0); // return this
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
      err = new XYZTimeoutError(this);
      this.injectStackTrace(err);
    }
    if (err) {
      throw err;
    }
  }

  unwind(err) {
    // unwind the call stack searching for a guard
    // 展开调用堆栈以寻找守卫
    let frame = this.callStack[this.depth];
    while (frame) {
      // ensure the error is set on the current frame
      let len;
      frame.error = err;
      // ip is always pointing to the next instruction, so subtract one
      // ip 总是指向下一条指令，所以减去一条
      const ip = frame.ip - 1;
      if ((len = frame.guards.length)) {
        const guard = frame.guards[len - 1];
        if (guard.start <= ip && ip <= guard.end) {
          if (guard.handler !== null) {
            // try/catch
            if (ip <= guard.handler) {
              // thrown inside the guarded region
              frame.evalStack.push(err);
              frame.error = null;
              frame.ip = guard.handler;
            } else {
              // thrown outside the guarded region(eg: catch or finally block)
              if (guard.finalizer && frame.ip <= guard.finalizer) {
                // there's a finally block and it was thrown inside the
                // catch block, make sure  executed
                frame.ip = guard.finalizer;
              } else {
                frame = this.popFrame();
                continue;
              }
            }
          } else {
            // try/finally
            frame.ip = guard.finalizer;
          }
          frame.paused = false;
          return frame;
        }
      }
      frame = this.popFrame();
    }
    throw err;
  }

  injectStackTrace(err) {
    const trace: Trace[] = [];
    let minDepth = 0;
    if (this.depth > this.maxTraceDepth) {
      minDepth = this.depth - this.maxTraceDepth;
    }
    for (
      let i = this.depth, end = minDepth, asc = this.depth <= end;
      asc ? i <= end : i >= end;
      asc ? i++ : i--
    ) {
      const frame = this.callStack[i];
      let { name } = frame.script;
      if (name === '<anonymous>' && frame.fname) {
        name = frame.fname;
      }
      trace.push({
        at: {
          name,
          filename: frame.script.filename,
        },
        line: frame.line,
        column: frame.column,
      });
    }
    if (err.trace) {
      let t = err.trace;
      // error was rethrown, inject the current trace at the end of
      // the leaf trace
      while (isArray(t[t.length - 1])) {
        t = t[t.length - 1];
      }
      t.push(trace);
    } else {
      err.trace = trace;
    }
    // show stack trace on node.js
    return (err.stack = err.toString());
  }

  pushFrame(script, target, parent, args, self, name, construct) {
    if (name == null) {
      name = '<anonymous>';
    }
    if (construct == null) {
      construct = false;
    }
    if (!this.checkCallStack()) {
      return;
    }
    const scope = new Scope(parent, script.localNames, script.localLength);
    scope.set(0, target);
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

  pushEvalFrame(frame, script) {
    if (!this.checkCallStack()) {
      return;
    }
    return (this.callStack[++this.depth] = new EvalFrame(frame, script));
  }

  checkCallStack() {
    if (this.depth === this.maxDepth) {
      this.callStack[this.depth].error = new XYZError('maximum call stack size exceeded');
      this.pause();
      return false;
    }
    return true;
  }

  popFrame() {
    const frame = this.callStack[--this.depth];
    if (frame) {
      frame.paused = false;
    }
    return frame;
  }

  setReturnValue(rv) {
    return this.callStack[this.depth].evalStack.push(rv);
  }

  pause() {
    // eslint-disable-next-line no-return-assign
    return (this.paused = this.callStack[this.depth].paused = true);
  }

  resume(timeout) {
    if (timeout == null) {
      timeout = -1;
    }
    this.timeout = timeout;
    this.paused = false;
    const frame = this.callStack[this.depth];
    frame.paused = false;
    const { evalStack } = this.callStack[0];
    this.run();
    if (!this.paused) {
      return this.rexp;
    }
  }

  timedOut() {
    return this.timeout === 0;
  }

  send(obj) {
    return this.callStack[this.depth].evalStack.push(obj);
  }

  done() {
    return this.depth === -1;
  }
}
