import { transformEXP, transform } from '../src/compiler';
import { Vm } from '../src/vm/vm';

export const run = function (code, ctx = {}, hoisting = true, convertES5 = false) {
  const script = transform(code, '', { hoisting, convertES5 });
  const vm = new Vm(ctx);
  const res = vm.run(script);
  return (vm.realm.global as any).module.exports;
};

export const runExp = function (code: string, ctx = {}) {
  const script = transformEXP(code);
  const vm = new Vm(ctx);
  const res = vm.run(script);
  return res;
};
