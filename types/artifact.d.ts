export const ARTIFACT_MAGIC: 'JSVM3';
export const ARTIFACT_FORMAT: 1;
export const OPCODE_VERSION: 1;
export const OPCODE_MIN: 1;
export const OPCODE_MAX: 1;
export const FORMAT_MIN: 0;
export const FORMAT_MAX: 1;

export type ScriptJson = [
  fName: string | 0,
  name: string | 0,
  instructions: Array<Array<number | string | null>>,
  children: ScriptJson[],
  localNames: unknown[],
  guards: Array<[number, number, number, number]>,
  stackSize: number,
  strings: unknown,
  regexps: string[],
  globalNames: unknown[]
];

export interface Artifact {
  readonly magic: typeof ARTIFACT_MAGIC;
  readonly format: number;
  readonly opcode: number;
  readonly compiler: string;
  readonly filename?: string;
  readonly debug?: { source?: string; maps?: unknown };
  readonly body: ScriptJson;
}

export type ArtifactInput = Artifact | ScriptJson;

export interface CompileOptions {
  filename?: string;
  hoisting?: boolean;
  convertES5?: boolean;
  debug?: boolean;
  format?: 0 | 1;
}

export interface DumpableInstruction {
  readonly id: number;
  readonly args?: ReadonlyArray<unknown> | null;
}

export interface DumpableScript {
  readonly fName?: string | null;
  readonly name?: string | null;
  readonly instructions: ReadonlyArray<DumpableInstruction>;
  readonly children: ReadonlyArray<DumpableScript>;
  readonly localNames: unknown[];
  readonly globalNames?: unknown[];
  readonly guards: ReadonlyArray<{
    start?: number | null;
    handler?: number | null;
    finalizer?: number | null;
    end?: number | null;
  }>;
  readonly stackSize: number;
  readonly strings: unknown;
  readonly regexps: ReadonlyArray<RegExp>;
}

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
