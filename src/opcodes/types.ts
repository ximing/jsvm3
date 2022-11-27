import type { Frame } from '../vm/frame';
import type { Scope } from '../vm/scope';
import { EvaluationStack } from '../vm/stack';
import { Realm } from '../vm/realm';

export type OPExec = (frame: Frame, stack: EvaluationStack, scope: Scope, realm: Realm) => any;

export type Instruction = {
  name: string;
  id: number;
  exec: OPExec;
  calculateFactor: () => number;
  args: any[];
  forEachLabel: (args?: any) => any;
};
