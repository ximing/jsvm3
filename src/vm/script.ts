// convert compiled scripts from/to json-compatible structure
import { Instruction } from '../opcodes/types';
// @ifdef COMPILER
import { scriptToJson } from '../utils/convert';
// @endif

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
  regexps: RegExp[];
  source: any;
  paramsSize = 0;

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

  // @ifdef COMPILER
  toJSON() {
    return scriptToJson(this);
  }
  // @endif
}
