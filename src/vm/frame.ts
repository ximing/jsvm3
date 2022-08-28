import type { Fiber } from './fiber';
import { Scope } from './scope';
import { Realm } from './realm';
import { EvaluationStack } from './stack';
import type { Script } from './script';
import { Guard } from './types';

/*
 * 在 JavaScript 的执行环境中，每当一个函数被调用时，都会创建一个新的执行上下文，这个上下文就是 Frame。
 * 每个 Frame 包含了函数的参数、局部变量以及 this 值等信息。
 * 所有的 Frame 一起形成了一个调用栈，用于跟踪函数的执行过程
 * */
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

  ip: number; // Instruction Pointer
  exitIp: number;

  // 通常指的是一个在对象销毁或资源回收之前执行的清理函数或代码块。它的目的是在对象不再需要时释放或清理分配给该对象的资源，
  finalizer: any;

  /*
   * 用于管理异常处理和资源清理的机制。用于确保在执行过程中，即使发生错误或异常，资源也能被正确释放，且程序能够恢复到一个稳定的状态。
   * 异常处理路由：指向异常处理代码的指针，当函数执行过程中抛出异常时，可以根据这些信息跳转到相应的异常处理代码块。
   * 清理回调函数：在函数结束（无论正常结束还是异常结束）时需要调用的清理函数或代码块的引用。
   * */
  guards: Guard[];

  rv: any; // return value

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
  }

  run() {
    let len;
    const frame = this;
    const { instructions } = frame.script;
    while (frame.ip !== frame.exitIp && !frame.suspended && frame.fiber.timeout !== 0) {
      frame.fiber.timeout--;
      const ins = instructions[frame.ip++];
      // const iii = this.calc(ins);
      // const now = Date.now();
      ins.run(frame, frame.evalStack, this._scope!, frame.realm, ins.args);
      // iii.count += 1;
      // const diff = Date.now() - now;
      // iii.time += diff;
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

  // 后续，会使用这些方法去触发listeners(eg: debugger)
  setLine(line) {
    this.line = line;
  }

  setColumn(column) {
    this.column = column;
  }
}
