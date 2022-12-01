import type { Fiber } from './fiber';
import type { Scope } from './scope';
import { Realm } from './realm';
import { EvaluationStack } from './stack';
import type { Script } from './script';

export class Frame {
  fiber: Fiber;
  srt: Script;
  scp: Scope | null;

  error: any;
  paused: boolean;

  realm: Realm;
  // frame name
  fname: any;
  _eStack: EvaluationStack;
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
    scope: Scope,
    realm: Realm,
    fname: string,
    construct = false
  ) {
    const t = this;
    t.fiber = fiber;
    t.srt = script;
    t.scp = scope;
    t.realm = realm;
    t.fname = fname;
    t.construct = construct;
    t._eStack = new EvaluationStack(t.srt.stackSize, t.fiber);
    t.ip = 0;
    t.exitIp = t.srt.instructions.length;
    t.paused = false;
    t.finalizer = null;
    t.guards = [];
    t.rv = undefined;
    t.line = t.column = -1;
    t.lref = [];
  }

  run() {
    let len;
    const t = this;
    const { instructions } = t.srt;
    while (t.ip !== t.exitIp && !t.paused && t.fiber.timeout !== 0) {
      t.fiber.timeout--;
      const ins = instructions[t.ip++];
      ins.exec(t, t._eStack, t.scp!, t.realm);
      // console.log(`\x1B[36m${ins.name}\x1B[0m`, ins.args, this.error, this.paused, ins.id);
    }
    if (t.fiber.timeout === 0) {
      t.paused = t.fiber.paused = true;
    }
    if (!t.paused && !t.error && (len = t._eStack.len()) !== 0) {
      // debug assertion
      throw new Error(`_eStack has ${len} items after run`);
    }
  }

  done() {
    return this.ip === this.exitIp;
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
