/*
* 在 JavaScript 中，Realm 可以看作是一个全局环境，它包含了 JavaScript 的内置对象（如 Array、Object、Function 等）以及相关的执行环境。
* 每个 Realm 都有自己的全局对象，不同的 Realm 之间是完全隔离的。
* */
export class Realm {
  globalObj: any;
  constructor(merge: Record<string, any> = {}) {
    // @if CURRENT != 'all'
    this.globalObj = {};
    // @endif
    for (const k of Object.keys(merge)) {
      const v = merge[k];
      this.globalObj[k] = v;
    }

  }
}
