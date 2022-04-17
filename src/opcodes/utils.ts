import { Instruction, OPExec } from './types';
import type { Frame } from '../vm/frame';
import { InsMap } from './ins';
// @ifdef COMPILER
import { OPCodeIdx } from './opIdx';
import { Label } from './label';
import { Cannot } from './contants';

const OPCodeMap: any = Object.keys(OPCodeIdx).reduce((total: any, cur: string) => {
  total[OPCodeIdx[cur]] = cur;
  return total;
}, {});
// @endif

export const createOP = function (
  id: number,
  fn: OPExec,
  calculateFactor?: (this: Instruction) => number
) {
  // @ts-ignore
  const base: Instruction = {
    // runtime
    id,
    run: fn,
    // runtime end

    // @ifdef COMPILER
    name: OPCodeMap[id],
    calculateFactor:
      calculateFactor ||
      function () {
        return 0;
      },
    forEachLabel(cb) {
      if (this.args) {
        const result = [];
        for (let i = 0, end = this.args.length; i < end; i++) {
          if (this.args[i] instanceof Label) {
            // @ts-ignore
            result.push((this.args[i] = cb(this.args[i])));
          } else {
            // @ts-ignore
            result.push(undefined);
          }
        }
        return result;
      }
    },
    // @endif
  };
  InsMap.set(id, base);
  return (args: any) => Object.assign({ args }, base) as Instruction;
};

export const ret = function (frame: Frame) {
  frame.evalStack.clear();
  return (frame.exitIp = frame.ip);
};
