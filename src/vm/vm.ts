import { Realm } from './realm';
import { Fiber } from './fiber';
import { Script } from './script';

export class XYZ {
  realm: Realm;

  constructor(merge = {}) {
    this.realm = new Realm(merge);
    // if (allowEval) {
    //   this.realm.compileFunction = Vm.compileFunction;
    //   this.realm.eval = this.realm.global.eval = Vm.compileEval;
    // }
  }

  go(script: Script, timeout = -1) {
    const fiber = this.createFiber(script, timeout);
    fiber.run();
    if (!fiber.suspended) {
      // fiber.insMap.forEach((val, key) => {
      //   console.log(key, val.count, val.time, '--->', val.time / val.count);
      // });
      // console.log(Object.fromEntries(fiber.insMap));
      return fiber.rexp;
    }
  }

  createFiber(script: Script, timeout = -1) {
    const fiber = new Fiber(this.realm, timeout);
    fiber.pushFrame(script, this.realm.globalObj);
    return fiber;
  }
}
