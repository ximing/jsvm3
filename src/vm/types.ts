import type { Label } from '../opcodes/label';

export type Trace = {
  at: {
    name: string;
    fName: string;
  };
  line: number;
  column: number;
};

export type Guard = {
  start: Label | number | null;
  handler: Label | null | number;
  finalizer: Label | null | number;
  end: Label | number | null;
};
