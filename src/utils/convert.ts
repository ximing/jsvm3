import { Script } from '../vm/script';
import { Instruction } from '../opcodes/types';
import { InsMap } from '../opcodes/ins';
import {
  ARTIFACT_FORMAT,
  ARTIFACT_MAGIC,
  FORMAT_MAX,
  FORMAT_MIN,
  OPCODE_MAX,
  OPCODE_MIN,
  OPCODE_VERSION,
} from '../artifact/version';
import { Artifact, DumpableScript, ScriptJson } from '../artifact/types';
import { ArtifactFormatError, ArtifactLoadError, ArtifactVersionError } from '../artifact/errors';

const scriptFromJson = function (json: any) {
  const fName = json[0] !== 0 ? json[0] : null;
  const name = json[1] !== 0 ? json[1] : null;
  const instructions = instructionsFromJson(json[2]);
  const children: any[] = [];
  const localNames = json[4];
  const localLength = localNames.length;
  const guards: any[] = [];
  const stackSize = json[6];
  const strings = json[7];
  const regexps: any = [];
  for (const s of json[3]) {
    children.push(scriptFromJson(s));
  }
  for (const guard of json[5]) {
    guards.push({
      start: guard[0] !== -1 ? guard[0] : null,
      handler: guard[1] !== -1 ? guard[1] : null,
      finalizer: guard[2] !== -1 ? guard[2] : null,
      end: guard[3] !== -1 ? guard[3] : null,
    });
  }
  for (const regexp of json[8]) {
    regexps.push(regexpFromString(regexp));
  }
  const source = json[10] !== 0 ? json[10] : null;
  const script = new Script(
    fName,
    name,
    instructions,
    children,
    localNames,
    localLength,
    json[9] || [],
    guards,
    stackSize,
    strings,
    regexps,
    source
  );
  return script;
};

const versionRange = (min: number, max: number) => `${min}-${max}`;

const assertVersion = function (
  field: 'format' | 'opcode',
  value: unknown,
  min: number,
  max: number
) {
  if (typeof value !== 'number' || value < min || value > max) {
    throw new ArtifactVersionError(
      `unsupported artifact ${field} ${String(value)}`,
      field,
      versionRange(min, max),
      String(value)
    );
  }
};

export const loadArtifact = function (input: unknown) {
  if (Array.isArray(input)) {
    return scriptFromJson(input);
  }
  if (
    input !== null &&
    typeof input === 'object' &&
    (input as { magic?: unknown }).magic === ARTIFACT_MAGIC
  ) {
    const artifact = input as Artifact;
    assertVersion('format', artifact.format, FORMAT_MIN, FORMAT_MAX);
    assertVersion('opcode', artifact.opcode, OPCODE_MIN, OPCODE_MAX);
    return scriptFromJson(artifact.body);
  }
  throw new ArtifactFormatError(
    'invalid artifact: expected ScriptJson array or JSVM3 envelope',
    ARTIFACT_MAGIC,
    input !== null && typeof input === 'object'
      ? (input as { magic?: unknown }).magic
      : typeof input
  );
};

/** @deprecated Use loadArtifact. */
export const fromJson = loadArtifact;

export const regexpFromString = function (str: string) {
  const sliceIdx = str.lastIndexOf('/');
  const source = str.slice(0, sliceIdx);
  const flags = str.slice(sliceIdx + 1);
  return new RegExp(source, flags);
};

export const instructionsFromJson = function (instructions: any[][]) {
  const rv: Instruction[] = [];
  for (const inst of instructions) {
    const insFun = InsMap.get(inst[0]);
    if (!insFun) {
      throw new ArtifactLoadError(`unknown instruction id ${inst[0]}`);
    }
    const args: any[] = [];
    for (let i = 1, end = inst.length; i < end; i++) {
      args.push(inst[i]);
    }
    const opcode = insFun(args.length ? args : null);
    rv.push(opcode);
  }
  return rv;
};

export const regexpToString = function (regexp: RegExp) {
  let rv = regexp.source + '/';
  rv += regexp.global ? 'g' : '';
  rv += regexp.ignoreCase ? 'i' : '';
  rv += regexp.multiline ? 'm' : '';
  return rv;
};

export const instructionsToJson = function (instructions: Instruction[]) {
  const rv: any[][] = [];
  for (const inst of instructions) {
    let code: any[] = [inst.id];
    // @ifdef COMPILER
    if (process.env.JSVM_DEBUG) {
      code = [inst.name];
    }
    // code = [inst.name];
    // @endif
    if (inst.args) {
      for (const a of inst.args) {
        if (a != null) {
          code.push(a);
        } else {
          // @ts-ignore
          code.push(null);
        }
      }
    }
    rv.push(code);
  }
  return rv;
};

export const scriptToJsonObject = function (script: Script) {
  const obj: any = {
    fName: script.fName,
    name: script.name,
    instructions: instructionsToJson(script.instructions),
    localNames: script.localNames,
    globalNames: script.globalNames,
    stackSize: script.stackSize,
    strings: script.strings,
    children: [],
    guards: [],
    regexps: [],
  };
  for (const s of Array.from(script.children)) {
    obj.children.push(scriptToJsonObject(s));
  }
  for (const guard of Array.from(script.guards)) {
    obj.guards.push([
      guard.start || -1,
      guard.handler || -1,
      guard.finalizer || -1,
      guard.end || -1,
    ]);
  }
  for (const regexp of script.regexps) {
    obj.regexps.push(regexpToString(regexp));
  }
  return obj;
};

export const scriptToJson = function (script: Script) {
  const rv = [
    script.fName || 0,
    script.name || 0,
    instructionsToJson(script.instructions),
    [],
    script.localNames,
    [],
    script.stackSize,
    script.strings,
    [],
    script.globalNames,
  ];
  for (const s of Array.from(script.children)) {
    rv[3].push(scriptToJson(s));
  }
  for (const guard of Array.from(script.guards)) {
    rv[5].push([guard.start || -1, guard.handler || -1, guard.finalizer || -1, guard.end || -1]);
  }
  for (const regexp of script.regexps) {
    rv[8].push(regexpToString(regexp));
  }
  // rv[9] = script.source || 0;
  // rv[10] = script.source || 0;
  return rv;
};

export const dumpArtifact = function (
  // Script.guards still allow Label until PR 2; DumpableScript is the JSON shape.
  script: DumpableScript | Script,
  options?: { format?: 0 | 1; filename?: string; debug?: boolean; compiler?: string }
): ScriptJson | Artifact {
  const format = options?.format ?? 0;
  if (format !== 0 && format !== 1) {
    throw new ArtifactVersionError(
      `unsupported artifact format ${String(format)}`,
      'format',
      versionRange(FORMAT_MIN, FORMAT_MAX),
      String(format)
    );
  }
  const body = scriptToJson(script as Script) as ScriptJson;
  if (format === 0) {
    return body;
  }
  const artifact: Artifact = {
    magic: ARTIFACT_MAGIC,
    format: ARTIFACT_FORMAT,
    opcode: OPCODE_VERSION,
    compiler: options?.compiler ?? '1.3.0',
    body,
  };
  if (options?.filename !== undefined) {
    (artifact as { filename?: string }).filename = options.filename;
  }
  if (options?.debug) {
    (artifact as { debug?: { source?: string } }).debug = {
      source: (script as { source?: string }).source,
    };
  }
  return artifact;
};
