import type { Fiber } from './fiber';

export class EvaluationStack {
  fiber: Fiber;
  array: Array<any>;
  idx: number;
  push = this.p;
  pop = this.u;
  top = this.t;

  constructor(size, fiber) {
    this.fiber = fiber;
    this.array = new Array(size);
    this.idx = 0;
  }

  p(item) {
    // console.log('-----> push', this.idx + 1);
    if (this.idx === this.array.length) {
      throw new Error('maximum evaluation stack size exceeded');
    }
    return (this.array[this.idx++] = item);
  }

  u() {
    // console.log('-----> pop', this.idx - 1);
    return this.array[--this.idx];
  }

  t() {
    return this.array[this.idx - 1];
  }

  len() {
    return this.idx;
  }

  clear() {
    return (this.idx = 0);
  }
}
