// convert compiled children from/to json-compatible structure
import { Instruction } from '../opcodes/types';
// @ifdef COMPILER
import { scriptToJson } from '../utils/convert';
// import { scriptToJsonObject } from '../utils/convert';
// @endif

export class Script {
  fName: string;
  name: string;
  instructions: Instruction[];
  // eslint-disable-next-line no-use-before-define
  children: Script[];
  localNames: any[];
  globalNames: any[];
  localLength: number;
  guards: any[];
  stackSize: number;
  strings: any;
  regexps: RegExp[];
  // @ifdef COMPILER
  source: any;
  // @endif
  paramsSize = 0;

  // fName filename
  constructor(
    fName,
    name,
    instructions,
    children,
    localNames,
    localLength,
    globalNames,
    guards,
    stackSize,
    strings,
    regexps,
    // @ifdef COMPILER
    source?
    // @endif
  ) {
    const t = this;
    t.fName = fName;
    t.name = name;
    t.instructions = instructions;
    t.children = children;
    t.localNames = localNames;
    t.localLength = localLength;
    t.globalNames = globalNames;
    t.guards = guards;
    t.stackSize = stackSize;
    t.strings = strings;
    t.regexps = regexps;
    // @ifdef COMPILER
    t.source = source;
    // @endif
  }

  // @ifdef COMPILER
  toJSON() {
    // return scriptToJsonObject(this);
    return scriptToJson(this);
  }
  // @endif
}
