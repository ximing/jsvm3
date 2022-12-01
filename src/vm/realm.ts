import {
  XYZError,
  XYZEvalError,
  XYZRangeError,
  XYZReferenceError,
  XYZSyntaxError,
  XYZTypeError,
  XYZURIError,
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
    EvalError: XYZEvalError,
    RangeError: XYZRangeError,
    ReferenceError: XYZReferenceError,
    SyntaxError: XYZSyntaxError,
    TypeError: XYZTypeError,
    URIError: XYZURIError,
    StopIteration,
    Math,
    JSON,
    parseInt,
    parseFloat,
    Map,
    WeakMap,
    Set,
    WeakSet,
    Proxy,
    console,
    NaN,
    Promise,
    Infinity
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
