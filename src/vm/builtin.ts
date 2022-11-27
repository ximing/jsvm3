import { XYZError } from '../utils/errors';

export class StopIteration extends XYZError {
  static display = 'StopIteration';
  value: any;
  message: string;
  constructor(value?, message?) {
    super(message);
    this.value = value;
    if (message == null) {
      message = 'iterator has stopped';
    }
    this.message = message;
  }
}

export class ArrayIterator {
  elements: any[];
  index: number;
  constructor(elements) {
    this.elements = elements;
    this.index = 0;
  }

  next() {
    if (this.index >= this.elements.length) {
      throw new StopIteration();
    }
    return this.elements[this.index++];
  }
}
