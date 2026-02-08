import { transformEXP, transform } from '../src/compiler';
import { JSVM } from '../src/vm/vm';
import { dumpArtifact } from '../src/utils/convert';

export const run = function (code, ctx = {}, hoisting = true, convertES5 = false) {
  const script = transform(code, 'test.js', { hoisting, convertES5 });
  const vm = new JSVM(Object.assign({ Map: Map, WeakMap: WeakMap, Set: Set, Proxy: Proxy }, ctx));
  // Optional JSON round-trip (default off). Same defaults as before.
  if (process.env.JSVM_RUN_VIA_ARTIFACT) {
    vm.exec(JSON.parse(JSON.stringify(dumpArtifact(script))));
  } else {
    vm.exec(script);
  }
  return (vm.realm.globalObj as any).module.exports;
};

export const runExp = function (code: string, ctx = {}) {
  const script = transformEXP(code);
  const vm = new JSVM(ctx);
  const res = vm.exec(script);
  return res;
};
