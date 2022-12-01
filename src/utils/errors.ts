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
    const { name, filename } = frame.at;
    if (name) {
      rv += `\n${indent}at ${name} (${filename}:${l}:${c})`;
    } else {
      rv += `\n${indent}at ${filename}:${l}:${c}`;
    }
  }
  return rv;
}

export class XYZError {
  message: string;
  trace: null | Trace[];

  constructor(message) {
    this.message = message;
    this.trace = null;
  }

  toString() {
    // @ts-ignore
    const errName = this.constructor.display;
    let rv = `${errName}: ${this.message}`;
    if (this.trace) {
      rv += printTrace(this.trace);
    }
    return rv;
  }

  stackTrace() {
    return this.toString();
  }
}

// export class XYZEvalError extends XYZError {
//   static display = 'EvalError';
// }

export class XYZRangeError extends XYZError {
  static display = 'RangeError';
}

export class XYZReferenceError extends XYZError {
  static display = 'ReferenceError';
}

export class XYZSyntaxError extends XYZError {
  static display = 'SyntaxError';
}

export class XYZTypeError extends XYZError {
  static display = 'TypeError';
}

// export class XYZURIError extends XYZError {
//   static display = 'URIError';
// }

export class XYZTimeoutError extends XYZError {
  static display = 'TimeoutError';
  fiber: any;

  constructor(fiber) {
    super('Script timed out');
    this.fiber = fiber;
  }
}
