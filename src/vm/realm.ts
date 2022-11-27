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
  };

  constructor(merge: Record<string, any> = {}) {
    // @ts-ignore
    this.global.global = global;

    for (const k of Object.keys(merge)) {
      const v = merge[k];
      global[k] = v;
    }
  }
}
