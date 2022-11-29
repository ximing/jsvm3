// @ts-nocheck
import { Script } from '../vm/script';
import { Instruction } from '../opcodes/types';

export const scriptFromJson = function (json: any) {
  const filename = json[0] !== 0 ? json[0] : null;
  const name = json[1] !== 0 ? json[1] : null;
  const instructions = instructionsFromJson(json[2]);
  const scripts = [];
  const localNames = json[4];
  const localLength = localNames.length;
  const guards = [];
  const stackSize = json[6];
  const strings = json[7];
  const regexps = [];
  for (const s of Array.from(json[3])) {
    scripts.push(scriptFromJson(s));
  }
  for (const guard of Array.from(json[5])) {
    guards.push({
      start: guard[0] !== -1 ? guard[0] : null,
      handler: guard[1] !== -1 ? guard[1] : null,
      finalizer: guard[2] !== -1 ? guard[2] : null,
      end: guard[3] !== -1 ? guard[3] : null,
    });
  }
  for (const regexp of Array.from(json[8])) {
    regexps.push(regexpFromString(regexp));
  }
  const source = json[9] !== 0 ? json[9] : null;
  return new Script(
    filename,
    name,
    instructions,
    scripts,
    localNames,
    localLength,
    guards,
    stackSize,
    strings,
    regexps,
    source
  );
};

export const instructionsFromJson = function (instructions) {
  const rv = [];
  for (const inst of Array.from(instructions)) {
    const klass = opcodes[inst[0]];
    const args = [];
    for (let i = 1, end = inst.length, asc = end >= 1; asc ? i < end : i > end; asc ? i++ : i--) {
      args.push(inst[i]);
    }
    const opcode = new klass(args.length ? args : null);
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

export const regexpFromString = function (str) {
  const sliceIdx = str.lastIndexOf('/');
  const source = str.slice(0, sliceIdx);
  const flags = str.slice(sliceIdx + 1);
  return new RegExp(source, flags);
};

export const instructionsToJson = function (instructions: Instruction[]) {
  const rv: any[][] = [];
  for (const inst of instructions) {
    const code = [inst.name];
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
