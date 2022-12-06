const isArray = Array.isArray;
const hasProp = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
// 这主要用于设置运行时属性（例如：__mdid__），因此它们不可枚举
const defProp = (obj, prop, descriptor) => Object.defineProperty(obj, prop, descriptor);
export { hasProp, isArray, defProp };
