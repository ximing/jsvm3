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

export class JSVMError {
  message: string;
  _trace: null | Trace[];

  constructor(message) {
    this.message = message;
    this._trace = null;
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
}

export class JSVMReferenceError extends JSVMError {
  display = 'JSVMReferenceError';
}

export class JSVMSyntaxError extends JSVMError {
  display = 'JSVMSyntaxError';
}

export class JSVMTypeError extends JSVMError {
  display = 'JSVMTypeError';
}

// export class JSVMURIError extends JSVMError {
//   static display = 'JSVMURIError';
// }

export class JSVMTimeoutError extends JSVMError {
  display = 'JSVMTimeoutError';
  fiber: any;

  constructor(fiber) {
    super('timed out');
    this.fiber = fiber;
  }
}
