export * from './runtime';
export * from './compiler';
import { JSVM, JSVMOptions } from './runtime';
import { CompileOptions } from './artifact';

export interface RunOptions extends CompileOptions, JSVMOptions {
  host?: Record<string, unknown>;
}

export function run(source: string, options?: RunOptions): unknown;

export class FullJSVM extends JSVM {
  run(source: string, options?: CompileOptions & { timeout?: number }): unknown;
}
