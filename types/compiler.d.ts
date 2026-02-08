import { Script } from './runtime';
import { Artifact, CompileOptions, DumpableScript, ScriptJson } from './artifact';

/** @deprecated Cross-package callers should use compile() + loadArtifact(); same-process use accepts dual-instance risk. */
export function transform(
  code: string,
  fName: string,
  options?: { hoisting?: boolean; convertES5?: boolean }
): Script;

export function transformEXP(exp: string): Script;

export function compile(source: string, options?: CompileOptions): ScriptJson | Artifact;

export function dumpArtifact(
  script: DumpableScript,
  options?: { format?: 0 | 1; filename?: string; debug?: boolean; compiler?: string }
): ScriptJson | Artifact;
