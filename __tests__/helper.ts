import { transformEXP, transform } from '../src/compiler';
import { XYZ } from '../src/vm/vm';

export const run = function (code, ctx = {}, hoisting = true, convertES5 = false) {
  const script = transform(code, 'test.js', { hoisting, convertES5 });
  const vm = new XYZ(ctx);
  // console.log(JSON.stringify(script.toJSON(), null, 2));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const res = vm.run(script);
  // console.log(res);
  // console.log(JSON.stringify(script.toJSON(), null, 2));
  // console.log(vm.realm.global);
  return (vm.realm.global as any).module.exports;
};

export const runExp = function (code: string, ctx = {}) {
  const script = transformEXP(code);
  const vm = new XYZ(ctx);
  const res = vm.run(script);
  return res;
};
