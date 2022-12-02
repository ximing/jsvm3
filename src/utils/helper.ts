let create, defProp, isArray, prototypeOf;

const toStr = (obj: any) => Object.prototype.toString.call(obj);

// thanks john resig: http://ejohn.org/blog/objectgetprototypeof/
if (typeof Object.getPrototypeOf !== 'function') {
  // @ts-ignore
  // eslint-disable-next-line no-proto
  if (typeof ''.__proto__ === 'object') {
    // eslint-disable-next-line no-proto
    prototypeOf = (obj: any) => obj.__proto__;
  } else {
    prototypeOf = (obj: any) => obj.constructor.prototype;
  }
} else {
  prototypeOf = Object.getPrototypeOf;
}

if (typeof Object.create !== 'function') {
  create = (function () {
    const F = function () {};
    return function (o) {
      if (arguments.length !== 1) {
        throw new Error('Object.create implementation only accepts one parameter.');
      }
      F.prototype = o;
      return new F();
    };
  })();
} else {
  ({ create } = Object);
}

const hasProp = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

if (typeof Array.isArray !== 'function') {
  isArray = (obj) => toStr(obj) === '[object Array]';
} else {
  ({ isArray } = Array);
}

// This is used mainly to set runtime properties(eg: __mdid__) so they are
// not enumerable.
if (typeof Object.defineProperty === 'function') {
  defProp = (obj, prop, descriptor) => Object.defineProperty(obj, prop, descriptor);
} else {
  defProp = (
    obj,
    prop,
    descriptor // polyfill with a normal property set(it will be enumerable)
  ) => (obj[prop] = descriptor.value);
}
export { prototypeOf, create, hasProp, isArray, defProp };
