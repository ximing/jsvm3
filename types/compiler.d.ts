import { CrashReport, Script } from './runtime';
import { Artifact, CompileOptions, DumpableScript, ScriptJson } from './artifact';

export interface SymbolRange {
  ip: number;
  line: number;
  column: number;
  source: string | null;
}

export interface SymbolMap {
  version: 1;
  artifactId: string;
  filename: string;
  sources: Array<{ name: string; content: string }>;
  scripts: Array<{
    script: number;
    name: string | null;
    fName: string | null;
    ranges: SymbolRange[];
  }>;
}

export interface SymbolicatedFrame {
  script: number;
  name: string;
  fName: string;
  ip: number;
  source: string | null;
  line: number;
  column: number;
  lineText: string | null;
  mapped: boolean;
}

export interface Symbolicated {
  artifactId?: string;
  mismatch: boolean;
  error: { name: string; message: string };
  frames: SymbolicatedFrame[];
}

export interface CompileResult {
  artifact: ScriptJson | Artifact;
  map: SymbolMap | null;
}

/** @deprecated Cross-package callers should use compile() + loadArtifact(); same-process use accepts dual-instance risk. */
export function transform(
  code: string,
  fName: string,
  options?: { hoisting?: boolean; convertES5?: boolean }
): Script;

export function transformEXP(exp: string): Script;

export function compile(source: string, options?: CompileOptions): ScriptJson | Artifact;

export function compileWithMap(source: string, options?: CompileOptions): CompileResult;

export function reportFromError(err: { name?: string; message?: string; stack?: string }): CrashReport;

export function symbolicate(report: CrashReport, map: SymbolMap): Symbolicated;

export function formatSymbolicated(result: Symbolicated): string;

export function dumpArtifact(
  script: DumpableScript,
  options?: { format?: 0 | 1; filename?: string; debug?: boolean; compiler?: string }
): ScriptJson | Artifact;
