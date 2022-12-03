import type { Fiber } from './fiber';
import type { Scope } from './scope';
import { Realm } from './realm';
import { EvaluationStack } from './stack';
import type { Script } from './script';

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

  run() {
    let len;
    const t = this;
    const s = this._scope;
    const { instructions } = t.script;
    while (t.ip !== t.exitIp && !t.suspended && t.fiber.timeout !== 0) {
      t.fiber.timeout--;
      const ins = instructions[t.ip++];
      ins.exec(t, t.evalStack, s!, t.realm);
      // console.log(`\x1B[36m${ins.name}\x1B[0m`, ins.args, this.evalError, this.suspended, ins.id);
    }
    if (t.fiber.timeout === 0) {
      t.suspended = t.fiber.suspended = true;
    }
    if (!t.suspended && !t.evalError && (len = t.evalStack.len()) !== 0) {
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
