export class Scope {
  // eslint-disable-next-line no-use-before-define
  parentScope: Scope | null;
  names: Record<string, any>;
  data: Array<any>;

  constructor(parent: Scope | null, names: Record<string, any>, len: number) {
    this.parentScope = parent;
    this.names = names;
    this.data = new Array(len);
  }

  get(i: number) {
    return this.data[i];
  }

  set(i: number, value: any) {
    return (this.data[i] = value);
  }

  // 获取 name 对应的索引
  name(name: any) {
    for (const k of Object.keys(this.names || {})) {
      const v = this.names[k];
      if (v === name) {
        return parseInt(k);
      }
    }
    return -1;
  }
}
