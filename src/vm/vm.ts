import { Realm } from './realm';
import { Fiber } from './fiber';
import { Script } from './script';
import { ARTIFACT_MAGIC } from '../artifact/version';
import { ArtifactInput } from '../artifact/types';
import { loadArtifact } from '../utils/convert';

export interface JSVMOptions {
  /** Instruction budget, not wall-clock. Default -1 (unlimited). */
  timeout?: number;
  /** Default 1000. */
  maxDepth?: number;
  /** Restore realm globals and module.exports before each exec(). */
  resetOnExec?: boolean;
}

function isArtifact(input: unknown): boolean {
  return (
    input !== null &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    (input as { magic?: unknown }).magic === ARTIFACT_MAGIC
  );
}

/**
 * Not a sandbox: the default Realm injects host Object/Function/Promise/console.
 * Path B (JS strings) is equivalent to running JS in the current process.
 * `timeout` is an instruction budget, not wall-clock time.
 */
export class JSVM {
  realm: Realm;
  readonly defaultTimeout: number;
  readonly maxDepth: number;
  readonly resetOnExec: boolean;

  constructor(host?: Record<string, unknown>, options?: JSVMOptions) {
    this.realm = new Realm(host ?? {});
    this.defaultTimeout = options?.timeout ?? -1;
    this.maxDepth = options?.maxDepth ?? 1000;
    this.resetOnExec = options?.resetOnExec ?? false;
    this.realm.defaultTimeout = this.defaultTimeout;
    this.realm.maxDepth = this.maxDepth;
    // if (allowEval) {
    //   this.realm.compileFunction = Vm.compileFunction;
    //   this.realm.eval = this.realm.global.eval = Vm.compileEval;
    // }
  }

  reset() {
    this.realm.reset();
  }

  exec(input: Script | ArtifactInput, timeout?: number) {
    if (this.resetOnExec) {
      this.realm.reset();
    }
    if (typeof input === 'string') {
      throw new TypeError(
        'JSVM.exec does not accept source strings; use jsvm3/full run() or compile() + loadArtifact()'
      );
    }
    const script =
      isArtifact(input) || Array.isArray(input) ? loadArtifact(input) : (input as Script);
    const fiber = this.createFiber(script, timeout ?? this.defaultTimeout);
    fiber.run();
    if (!fiber.suspended) {
      return fiber.rexp;
    }
  }

  createFiber(script: Script, timeout = this.defaultTimeout) {
    const fiber = new Fiber(this.realm, timeout);
    fiber.maxDepth = this.maxDepth;
    fiber.pushFrame(script, this.realm.globalObj);
    return fiber;
  }
}
