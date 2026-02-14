/** Public runtime API. Generated copies live in dist/; this is the hand-written fallback. */

export class Realm {
  globalObj: any;
  constructor(merge?: Record<string, any>);
}

export class Fiber {
  realm: Realm;
  rexp: any;
  suspended: boolean;
  timeout: number;
  maxDepth: number;
  constructor(realm: Realm, timeout?: number);
  run(): void;
}

export type Guard = {
  start: number | null;
  handler: number | null;
  finalizer: number | null;
  end: number | null;
};

export type Instruction = {
  name?: string;
  id: number;
  run: (...args: any[]) => any;
  calculateFactor?: (this: Instruction) => number;
  args?: any[] | null;
  forEachLabel?: (this: Instruction, args?: any) => any;
};

export class Script {
  fName: string;
  name: string;
  instructions: Instruction[];
  children: Script[];
  localNames: any[];
  globalNames: any[];
  localLength: number;
  guards: Guard[];
  stackSize: number;
  strings: any;
  regexps: RegExp[];
  paramsSize: number;
}

export interface JSVMOptions {
  timeout?: number;
  maxDepth?: number;
  resetOnExec?: boolean;
}

export class JSVM {
  realm: Realm;
  readonly defaultTimeout: number;
  readonly maxDepth: number;
  readonly resetOnExec: boolean;
  constructor(host?: Record<string, unknown>, options?: JSVMOptions);
  reset(): void;
  exec(input: Script | import('./artifact').ArtifactInput, timeout?: number): unknown;
  createFiber(script: Script, timeout?: number): Fiber;
}

export function loadArtifact(input: unknown): Script;
/** @deprecated Use loadArtifact. */
export function fromJson(input: unknown): Script;

export class ArtifactFormatError extends Error {
  readonly code: 'ARTIFACT_FORMAT';
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly display: 'ArtifactFormatError';
  constructor(message: string, expected?: unknown, actual?: unknown);
}

export class ArtifactVersionError extends Error {
  readonly code: 'ARTIFACT_VERSION';
  readonly field: 'format' | 'opcode';
  readonly expected: string;
  readonly actual: string;
  readonly display: 'ArtifactVersionError';
  constructor(message: string, field: 'format' | 'opcode', expected: string, actual: string);
}

export class ArtifactLoadError extends Error {
  readonly code: 'ARTIFACT_LOAD';
  readonly display: 'ArtifactLoadError';
  constructor(message: string);
}

export class CompileError extends Error {
  readonly code: 'COMPILE_ERROR';
  readonly filename?: string;
  readonly display: 'CompileError';
  constructor(message: string, filename?: string, options?: { cause?: unknown });
}
