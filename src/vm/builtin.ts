import { JSVMError } from '../utils/errors';

export class StopIteration extends JSVMError {
  display = 'StopIter';
  value: any;
  message: string;
  constructor(value?, message?) {
    super(message);
    this.value = value;
    this.message = message;
  }
}
