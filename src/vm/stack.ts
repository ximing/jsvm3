import type { Fiber } from './fiber';

export class EvaluationStack {
  fiber: Fiber;
  array: Array<any>;
  idx: number;

  constructor(size, fiber) {
    this.fiber = fiber;
    this.array = new Array(size);
    this.idx = 0;
  }

  push(item) {
    if (this.idx === this.array.length) {
      throw new Error('maximum evaluation stack size exceeded');
    }
    return (this.array[this.idx++] = item);
  }

  pop() {
    // console.log('-----> idx', this.idx);
    return this.array[--this.idx];
  }

  top() {
    return this.array[this.idx - 1];
  }

  len() {
    return this.idx;
  }

  clear() {
    return (this.idx = 0);
  }
}
