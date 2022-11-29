import { ArrayIterator } from '../vm/builtin';
import { hasProp, prototypeOf } from '../utils/helper';

export function inv(o) {
  return -o;
}

export function lnot(o) {
  return !o;
}

export function not(o) {
  return ~o;
}

export function inc(o) {
  return o + 1;
}

export function dec(o) {
  return o - 1;
}

export function add(r, l) {
  return l + r;
}

export function sub(r, l) {
  return l - r;
}

export function mul(r, l) {
  return l * r;
}

export function div(r, l) {
  return l / r;
}

export function mod(r, l) {
  return l % r;
}

export function shl(r, l) {
  return l << r;
}

export function sar(r, l) {
  return l >> r;
}

export function shr(r, l) {
  return l >>> r;
}

export function or(r, l) {
  return l | r;
}

export function and(r, l) {
  return l & r;
}

export function xor(r, l) {
  return l ^ r;
}

export function exp(r, l) {
  return Math.pow(l, r);
}

export function ceq(r, l) {
  return l == r;
}

export function cneq(r, l) {
  return l != r;
}

export function cid(r, l) {
  return l === r;
}

export function cnid(r, l) {
  return l !== r;
}

export function lt(r, l) {
  return l < r;
}

export function lte(r, l) {
  return l <= r;
}

export function gt(r, l) {
  return l > r;
}

export function gte(r, l) {
  return l >= r;
}

export function has(obj, key) {
  return Reflect.has(obj, key);
}

export function get(obj, key) {
  // "".concat
  if (obj == null) {
    return undefined;
  }
  const type = typeof obj;
  if (type === 'object') {
    return Reflect.get(obj, key);
  }
  if ((type === 'string' && typeof key === 'number') || key === 'length') {
    return obj[key];
  }
  if (hasProp(obj, key)) {
    return obj[key];
  }
  return get(prototypeOf(obj), key);
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

export function enumerateKeys(obj) {
  const keys: string[] = [];
  for (const key in obj) {
    if (key !== '__mdid__') {
      keys.push(key);
    }
  }
  return new ArrayIterator(keys);
}
