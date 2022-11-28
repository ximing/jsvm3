import { OPCodeIdx } from './opIdx';
import { Label } from './label';
import { Instruction, OPExec } from './types';

export const createOP = function (
  name,
  fn: OPExec,
  // eslint-disable-next-line @typescript-eslint/ban-types
  calculateFactor?: Function
) {
  const base = {
    name,
    id: OPCodeIdx[name],
    exec: fn,
    calculateFactor,
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
  };
  if (!calculateFactor) {
    // base.factor = calculateOpcodeFactor(fn);
    // base.calculateFactor = function () {
    //   return this.factor;
    // };
    base.calculateFactor = function () {
      return 0;
    };
  }
  return (args: any) => Object.assign({ args }, base) as Instruction;
};
