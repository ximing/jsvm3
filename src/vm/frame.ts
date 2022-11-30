import type { Fiber } from './fiber';
import type { Scope } from './scope';
import { Realm } from './realm';
import { EvaluationStack } from './stack';
import type { Script } from './script';

export class Frame {
  fiber: Fiber;
  script: any;
  scope: Scope | null;

  error: any;
  paused: boolean;

  realm: Realm;
  // frame name
  fname: any;
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
    scope: Scope,
    realm: Realm,
    fname: string,
    construct = false
  ) {
    this.fiber = fiber;
    this.script = script;
    this.scope = scope;
    this.realm = realm;
    this.fname = fname;
    this.construct = construct;
    this.evalStack = new EvaluationStack(this.script.stackSize, this.fiber);
    this.ip = 0;
    this.exitIp = this.script.instructions.length;
    this.paused = false;
    this.finalizer = null;
    this.guards = [];
    this.rv = undefined;
    this.line = this.column = -1;
    this.lref = [];
  }

  run() {
    let len;
    const { instructions } = this.script;
    while (this.ip !== this.exitIp && !this.paused && this.fiber.timeout !== 0) {
      this.fiber.timeout--;
      instructions[this.ip++].exec(this, this.evalStack, this.scope, this.realm);
    }
    if (this.fiber.timeout === 0) {
      this.paused = this.fiber.paused = true;
    }
    if (!this.paused && !this.error && (len = this.evalStack.len()) !== 0) {
      // debug assertion
      throw new Error(`Evaluation stack has ${len} items after execution`);
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
