import type { Fiber } from './fiber';
import { Scope } from './scope';
import { Realm } from './realm';
import { EvaluationStack } from './stack';
import type { Script } from './script';

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

  ip: number;
  exitIp: number;
  finalizer: any;
  guards: any[];
  rv: any;
  lref: any[];

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
    t.lref = [];
  }

  // calc(ins: Instruction) {
  //   if (!this.fiber.insMap.has(ins.name)) {
  //     this.fiber.insMap.set(ins.name, { count: 0, time: 0 });
  //   }
  //   return this.fiber.insMap.get(ins.name);
  // }

  run() {
    let len;
    const frame = this;
    const { instructions } = frame.script;
    while (frame.ip !== frame.exitIp && !frame.suspended && frame.fiber.timeout !== 0) {
      frame.fiber.timeout--;
      const ins = instructions[frame.ip++];
      // const iii = this.calc(ins);
      // const now = process.hrtime();

      ins.run(frame, frame.evalStack, this._scope!, frame.realm, ins.args);

      // iii.count += 1;
      // const diff = process.hrtime(now);
      // iii.time += diff[0] * 1e9 + diff[1];
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

  // later we will use these methods to notify listeners(eg: debugger)
  // about line/column changes
  setLine(line) {
    this.line = line;
  }

  setColumn(column) {
    this.column = column;
  }
}
