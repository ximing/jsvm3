import {
  XYZError,
  XYZTypeError,
  XYZRangeError,
  XYZReferenceError,
  XYZSyntaxError,
} from '../utils/errors';
// @if CURRENT != 'exp'
import { StopIteration } from './builtin';
// @endif

export class Realm {
  globalObj: any;
  constructor(merge: Record<string, any> = {}) {
    // @if CURRENT != 'all'
    this.globalObj = {};
    // @endif

    // @if CURRENT == 'all'
    this.globalObj = {
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
    // @endif

    for (const k of Object.keys(merge)) {
      const v = merge[k];
      this.globalObj[k] = v;
    }

    const $exports = {};
    const $module = { exports: $exports };
    (this.globalObj as any).module = $module;
    (this.globalObj as any).exports = $exports;
  }
}
