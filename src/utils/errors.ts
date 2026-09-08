import { Trace } from '../vm/types';
import { isArray } from './helper';

function printTrace(trace: Array<Trace | Trace[]>, indent?: string) {
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
    // ` ~script:ip` is the symbol address. One tail keeps it out of a second serializer.
    const tail = `:${l}:${c} ~${frame.script}:${frame.ip}`;
    if (name) {
      rv += `\n${indent}at ${name} (${fName}${tail})`;
    } else {
      rv += `\n${indent}at ${fName}${tail}`;
    }
  }
  return rv;
}

export class JSVMError extends Error {
  display = 'JSVMError';
  _trace: null | Array<Trace | Trace[]>;

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
    if ((this as { aid?: string }).aid) {
      rv += `\n#${(this as { aid?: string }).aid}`;
    }
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
