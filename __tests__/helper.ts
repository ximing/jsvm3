import { transformEXP, transform } from '../src/compiler';
import { JSVM } from '../src/vm/vm';

export const run = function (code, ctx = {}, hoisting = true, convertES5 = false) {
  const script = transform(code, 'test.js', { hoisting, convertES5 });
  const vm = new JSVM(Object.assign({ Map: Map, WeakMap: WeakMap, Set: Set, Proxy: Proxy }, ctx));
  // console.log(JSON.stringify(script.toJSON(), null, 2));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const res = vm.go(script);
  // console.log(res);
  // console.log(JSON.stringify(script.toJSON(), null, 2));
  // console.log(vm.realm.globalObj);
  return (vm.realm.globalObj as any).module.exports;
};

export const runExp = function (code: string, ctx = {}) {
  const script = transformEXP(code);
  const vm = new JSVM(ctx);
  const res = vm.go(script);
  return res;
};
