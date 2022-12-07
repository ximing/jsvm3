// @if CURRENT != 'exp'
import { ArrayIterator } from '../vm/builtin';
// @endif

import { hasProp } from '../utils/helper';

export function has(obj, key) {
  return Reflect.has(obj, key);
}

export function get(obj, key) {
  // console.log('get', obj, key);
  // "".concat
  if (obj == null) {
    return undefined;
  }
  const type = typeof obj;
  if (type === 'object' || type === 'function') {
    return Reflect.get(obj, key);
  }
  if ((type === 'string' && typeof key === 'number') || key === 'length') {
    return obj[key];
  }
  if (hasProp(obj, key)) {
    return obj[key];
  }
  return get(Object.getPrototypeOf(obj), key);
}

export function set(obj, key, val) {
  Reflect.set(obj, key, val);
  return val;
}

export function del(obj, key) {
  Reflect.deleteProperty(obj, key);
  return true;
}

export function instanceOf(klass, obj) {
  return obj instanceof klass;
}
// @if CURRENT != 'exp'
export function enumerateKeys(obj) {
  const keys: string[] = [];
  for (const key in obj) {
    if (key !== '__mdid__') {
      keys.push(key);
    }
  }
  return new ArrayIterator(keys);
}
// @endif
