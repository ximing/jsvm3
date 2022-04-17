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
