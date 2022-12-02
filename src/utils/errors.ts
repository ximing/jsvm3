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

export class XYZError {
  message: string;
  _trace: null | Trace[];

  constructor(message) {
    this.message = message;
    this._trace = null;
  }

  toString() {
    // @ts-ignore
    const errName = this.constructor.display;
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

// export class XYZEvalError extends XYZError {
//   static display = 'EvalError';
// }

export class XYZRangeError extends XYZError {
  static display = 'RangeErr';
}

export class XYZReferenceError extends XYZError {
  static display = 'RefErr';
}

export class XYZSyntaxError extends XYZError {
  static display = 'SynErr';
}

export class XYZTypeError extends XYZError {
  static display = 'TyErr';
}

// export class XYZURIError extends XYZError {
//   static display = 'URIError';
// }

export class XYZTimeoutError extends XYZError {
  static display = 'TErr';
  fiber: any;

  constructor(fiber) {
    super('timed out');
    this.fiber = fiber;
  }
}
