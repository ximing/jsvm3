import type { Frame } from '../vm/frame';
import type { Scope } from '../vm/scope';
import { EvaluationStack } from '../vm/stack';
import { Realm } from '../vm/realm';

export type OPExec = (
  // eslint-disable-next-line no-use-before-define
  this: Instruction,
  frame: Frame,
  stack: EvaluationStack,
  scope: Scope,
  realm: Realm
) => any;

export type Instruction = {
  name: string;
  id: number;
  exec: OPExec;
  calculateFactor: (this: Instruction) => number;
  args: any[];
  forEachLabel: (this: Instruction, args?: any) => any;
};
