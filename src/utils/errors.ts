import { Trace } from '../vm/types';
import { isArray } from './helper';

function printTrace(trace: Trace[], indent?: string) {
  if (indent == null) {
    indent = '';
  }
  indent += '    ';
  let rv = '';
  for (const frame of trace) {
    if (isArray(frame)) {
      rv += `\n\n${indent}Rethrown:`;
      // @ts-ignore
      rv += printTrace(frame, indent);
      continue;
    }
    const l = frame.line;
    const c = frame.column;
    const name = frame.at.name;
    const fName = frame.at.fName;
    if (name) {
      rv += `\n${indent}at ${name} (${fName}:${l}:${c})`;
    } else {
      rv += `\n${indent}at ${fName}:${l}:${c}`;
    }
  }
  return rv;
}

export class JSVMError extends Error {
  display = 'JSVMError';
  _trace: null | Trace[];

  constructor(message?: string) {
    super(message);
    this.name = 'JSVMError';
    this._trace = null;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toString() {
    // @ts-ignore
    const errName = this.display;
    let rv = `${errName}: ${this.message}`;
    if (this._trace) {
      rv += printTrace(this._trace);
    }
    return rv;
  }

  stackTrace() {
    return this.toString();
  }
}

// export class JSVMEvalError extends JSVMError {
//   static display = 'JSVMEvalError';
// }

export class JSVMRangeError extends JSVMError {
  display = 'JSVMRangeError';
  constructor(message?: string) {
    super(message);
    this.name = 'JSVMRangeError';
  }
}

export class JSVMReferenceError extends JSVMError {
  display = 'JSVMReferenceError';
  constructor(message?: string) {
    super(message);
    this.name = 'JSVMReferenceError';
  }
}

export class JSVMSyntaxError extends JSVMError {
  display = 'JSVMSyntaxError';
  constructor(message?: string) {
    super(message);
    this.name = 'JSVMSyntaxError';
  }
}

export class JSVMTypeError extends JSVMError {
  display = 'JSVMTypeError';
  constructor(message?: string) {
    super(message);
    this.name = 'JSVMTypeError';
  }
}

// export class JSVMURIError extends JSVMError {
//   static display = 'JSVMURIError';
// }

export class JSVMTimeoutError extends JSVMError {
  display = 'JSVMTimeoutError';

  constructor() {
    super('timed out');
    this.name = 'JSVMTimeoutError';
  }
}
