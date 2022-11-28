// convert compiled scripts from/to json-compatible structure
import { Instruction } from '../opcodes/types';

const instructionsToJson = function (instructions: Instruction[]) {
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

export const regexpToString = function (regexp) {
  let rv = regexp.source + '/';
  rv += regexp.global ? 'g' : '';
  rv += regexp.ignoreCase ? 'i' : '';
  rv += regexp.multiline ? 'm' : '';
  return rv;
};

export const scriptToJson = function (script: Script) {
  const rv = [
    script.filename || 0,
    script.name || 0,
    instructionsToJson(script.instructions),
    [],
    script.localNames,
    [],
    script.stackSize,
    script.strings,
    [],
  ];
  for (const s of Array.from(script.scripts)) {
    rv[3].push(scriptToJson(s));
  }
  for (const guard of Array.from(script.guards)) {
    rv[5].push([guard.start || -1, guard.handler || -1, guard.finalizer || -1, guard.end || -1]);
  }
  for (const regexp of Array.from(script.regexps)) {
    rv[8].push(regexpToString(regexp));
  }
  rv[9] = script.source || 0;
  return rv;
};

export class Script {
  filename: string;
  name: string;
  instructions: Instruction[];
  // eslint-disable-next-line no-use-before-define
  scripts: Script[];
  localNames: Record<string, any>;
  localLength: number;
  guards: any[];
  stackSize: number;
  strings: any;
  regexps: any;
  source: any;

  constructor(
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
    source?
  ) {
    this.filename = filename;
    this.name = name;
    this.instructions = instructions;
    this.scripts = scripts;
    this.localNames = localNames;
    this.localLength = localLength;
    this.guards = guards;
    this.stackSize = stackSize;
    this.strings = strings;
    this.regexps = regexps;
    this.source = source;
  }

  toJSON() {
    return scriptToJson(this);
  }
}
