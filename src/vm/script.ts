// convert compiled children from/to json-compatible structure
import { Instruction } from '../opcodes/types';
// @ifdef COMPILER
import { scriptToJson } from '../utils/convert';
// @endif

export class Script {
  filename: string;
  name: string;
  instructions: Instruction[];
  // eslint-disable-next-line no-use-before-define
  children: Script[];
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
    children,
    localNames,
    localLength,
    guards,
    stackSize,
    strings,
    regexps,
    source?
  ) {
    const t = this;
    t.filename = filename;
    t.name = name;
    t.instructions = instructions;
    t.children = children;
    t.localNames = localNames;
    t.localLength = localLength;
    t.guards = guards;
    t.stackSize = stackSize;
    t.strings = strings;
    t.regexps = regexps;
    t.source = source;
  }

  // @ifdef COMPILER
  toJSON() {
    return scriptToJson(this);
  }
  // @endif
}
