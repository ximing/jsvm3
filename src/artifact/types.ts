import { ARTIFACT_MAGIC } from './version';

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
