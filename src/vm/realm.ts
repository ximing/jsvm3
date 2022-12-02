import {
  XYZError,
  XYZTypeError,
  XYZRangeError,
  XYZReferenceError,
  XYZSyntaxError,
} from '../utils/errors';
import { StopIteration } from './builtin';

export class Realm {
  global = {
    undefined,
    Object,
    Function,
    Number,
    Boolean,
    String,
    Array,
    Date,
    RegExp,
    Error: XYZError,
    TypeError: XYZTypeError,
    RangeError: XYZRangeError,
    ReferenceError: XYZReferenceError,
    SyntaxError: XYZSyntaxError,
    // EvalError: XYZEvalError,
    // URIError: XYZURIError,
    StopIteration,
    Math,
    JSON,
    parseInt,
    parseFloat,
    console,
    NaN,
    Promise,
    Infinity,
  };

  constructor(merge: Record<string, any> = {}) {
    // @ts-ignore
    this.global.global = this.global;

    for (const k of Object.keys(merge)) {
      const v = merge[k];
      this.global[k] = v;
    }
    const $exports = {};
    const $module = { exports: $exports };
    (this.global as any).module = $module;
    (this.global as any).exports = $exports;
  }
}
