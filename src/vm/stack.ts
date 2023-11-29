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
    // console.log('-----> push', this.idx + 1);
    if (this.idx === this.array.length) {
      // maximum
      throw new Error('max _estack size');
    }
    return (this.array[this.idx++] = item);
  }

  pop() {
    return this.array[--this.idx];
  }

  top() {
    return this.array[this.idx - 1];
  }

  tail(length: number) {
    const end = this.idx;
    this.idx -= length;
    return this.array.slice(this.idx, end);
  }

  len() {
    return this.idx;
  }

  clear() {
    this.idx = 0;
  }
}
