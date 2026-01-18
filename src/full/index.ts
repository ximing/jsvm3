// Thin facade: Rollup must leave jsvm3/runtime and jsvm3/compiler external
// so this entry never embeds a second JSVM / InsMap.
import { compile } from 'jsvm3/compiler';
import { JSVM } from 'jsvm3/runtime';
import type { JSVMOptions } from 'jsvm3/runtime';
import type { CompileOptions } from '../artifact';

export {
  JSVM,
  fromJson,
  loadArtifact,
  ArtifactFormatError,
  ArtifactVersionError,
  ArtifactLoadError,
  CompileError,
} from 'jsvm3/runtime';
export type { JSVMOptions } from 'jsvm3/runtime';
export { transform, transformEXP, compile } from 'jsvm3/compiler';

export interface RunOptions extends CompileOptions, JSVMOptions {
  host?: Record<string, unknown>;
}

/**
 * Not a sandbox: path B is equivalent to running JS in the current process.
 * Returns realm.globalObj.module.exports (not exec's rexp).
 * convertES5 defaults to true via compile().
 */
export function run(source: string, options?: RunOptions): unknown {
  const json = compile(source, options);
  const vm = new JSVM(options?.host, options);
  vm.exec(json, options?.timeout);
  return (vm.realm.globalObj as { module: { exports: unknown } }).module.exports;
}

export class FullJSVM extends JSVM {
  run(source: string, options?: CompileOptions & { timeout?: number }): unknown {
    const json = compile(source, options);
    this.exec(json, options?.timeout);
    return (this.realm.globalObj as { module: { exports: unknown } }).module.exports;
  }
}
