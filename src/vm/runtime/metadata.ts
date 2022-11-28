// @ts-nocheck
import { hasProp } from '../../utils/helper';
import { ArrayIterator } from '../builtin';

// Vm 实例将操作创建/修改 由宿主引擎提供的原生对象
// Vm 中的代码可以通过两种方式访问本机对象：
//   1. 该对象是在 Vm 内部创建的（例如：literals）
//   2. 对象被注入到全局对象
// 由于 Vm 已经在一个有效的 javascript 引擎中运行，我们会跳过重新实现基本的内置对象，如 Array，String, JSON...
// 这种方法的问题是：我们需要将这些内置对象暴露给Vm 全局对象，让不受信任的代码修改其外部的全局变量
// 如果我们想要沙盒功能，Context的方案就被排除了 （这个也适用于我们需要具有每个 Vm 状态的非内置对象）
// 所以这里我们有*Metadata Classes，它解决了一些问题：
//   - 它允许沙盒代码安全地读取/写入内置对象属性 从Host Vm 中获取而不接触真实对象。
//   - 它为内置对象提供仅在 Vm 内部可以使用的属性（像“迭代器”)
//   - 它让我们实现一些宿主 js 引擎无法提供的能力（例如：代理或 getters/setters）
// 它的工作原理：*元数据类的实例包含状态,运行时使用它来确定执行某种操作的行为,与与之关联的对象。
// 例如，元数据对象与原生内置关联的可以包含已删除/修改的列表属性，仅在 Vm 的Realm中考虑删除/修改了这些属性。
// Vm 可以使用两个属性来检索 ObjectMetadata与对象关联的实例:
//   - __md__   : ObjectMetadata instance
//   - __mdid__ : 与之关联的 ObjectMetadata 实例的 ID，并私下存储在与 Vm 关联的 Realm 中
// 当第一个 Realm 创建时，每个原生内置函数都会设置一个 __mdid__ 属性，所以每个 Vm 实例都会包含自己的私有状态内置。
// 对象也可以有一个 __md__ 属性来存储它的内联状态（默认情况下，非内置对象只存储实现 getters/setters 或代理的特殊属性）

export class PropertyDescriptor {
  enumerable: any;
  configurable: any;
  constructor(enumerable, configurable) {
    if (enumerable == null) {
      enumerable = false;
    }
    this.enumerable = enumerable;
    if (configurable == null) {
      configurable = false;
    }
    this.configurable = configurable;
  }
}

export class DataPropertyDescriptor extends PropertyDescriptor {
  value: any;
  writable: any;
  constructor(value, writable, enumerable, configurable) {
    super(enumerable, configurable);
    this.value = value;
    if (writable == null) {
      writable = false;
    }
    this.writable = writable;
  }
}

export class AccessorPropertyDescriptor extends PropertyDescriptor {
  get: any;
  set: any;
  constructor(get, set, enumerable, configurable) {
    super(enumerable, configurable);
    this.get = get;
    this.set = set;
  }
}

export class ObjectMetadata {
  object: any;
  realm: any;
  proto: any;
  properties: Record<string, any>;
  extensible: boolean;

  constructor(object, realm) {
    this.object = object;
    this.realm = realm;
    this.proto = null;
    this.properties = {};
    this.extensible = true;
  }

  hasDefProperty(key) {
    return hasProp(this.properties, key);
  }

  hasOwnProperty(key) {
    return this.hasDefProperty(key) || hasProp(this.object, key);
  }

  getOwnProperty(key) {
    return this.properties[key] || this.object[key];
  }

  setOwnProperty(key, value) {
    return (this.object[key] = value);
  }

  delOwnProperty(key) {
    return delete this.properties[key] && delete this.object[key];
  }

  delDefProperty(key) {
    return delete this.properties[key];
  }

  searchProperty(key) {
    let prop;
    let md = this;
    while (md) {
      if (md.hasOwnProperty(key)) {
        prop = md.getOwnProperty(key);
        break;
      }
      md = md.proto || this.realm.mdproto(md.object);
    }
    return prop;
  }

  has(key, target) {
    if (target == null) {
      target = this.object;
    }
    let md = this;
    while (md) {
      if (md.hasOwnProperty(key)) {
        return true;
      }
      md = md.proto || this.realm.mdproto(md.object);
    }
    return false;
  }

  get(key, target) {
    if (target == null) {
      target = this.object;
    }
    const property = this.searchProperty(key);
    if (property instanceof AccessorPropertyDescriptor) {
      return property.get.call(target);
    }
    if (property instanceof DataPropertyDescriptor) {
      return property.value;
    }
    return property;
  }

  set(key, value, target) {
    if (target == null) {
      target = this.object;
    }
    const property = this.getOwnProperty(key);
    if (property instanceof AccessorPropertyDescriptor) {
      if (property.set) {
        property.set.call(target, value);
        return true;
      }
      return false;
    }
    if (property instanceof DataPropertyDescriptor) {
      if (property.writable) {
        property.value = value;
        return true;
      }
      return false;
    }
    if (property === undefined && !this.extensible) {
      return false;
    }
    this.setOwnProperty(key, value);
    return true;
  }

  del(key) {
    if (!this.hasOwnProperty(key)) {
      return false;
    }
    const property = this.getOwnProperty(key);
    if (property instanceof PropertyDescriptor && !property.configurable) {
      return false;
    }
    this.delOwnProperty(key);
    return true;
  }

  defineProperty(key, descriptor) {
    let prop;
    if (!this.extensible) {
      return false;
    }
    if ('value' in descriptor || 'writable' in descriptor) {
      prop = new DataPropertyDescriptor(
        descriptor.value,
        descriptor.writable,
        descriptor.enumerable,
        descriptor.configurable
      );
    } else if (typeof descriptor.get === 'function') {
      prop = new AccessorPropertyDescriptor(
        descriptor.get,
        descriptor.set,
        descriptor.enumerable,
        descriptor.writable
      );
    } else {
      return;
    }
    this.properties[key] = prop;
    return true;
  }

  instanceOf(klass) {
    let md = this;
    while (md !== null) {
      if (md.object === klass.prototype) {
        return true;
      }
      var { proto } = md;
      if (!proto) {
        return md.object instanceof klass;
      }
      md = proto;
    }
    return false;
  }

  isEnumerable(k) {
    const v = this.properties[k] || this.object[k];
    return !(v instanceof PropertyDescriptor) || v.enumerable;
  }

  ownKeys() {
    let k;
    const keys = [];
    for (k of Object.keys(this.object || {})) {
      if (this.isEnumerable(k)) {
        keys.push(k);
      }
    }
    for (k of Object.keys(this.properties || {})) {
      if (this.isEnumerable(k)) {
        keys.push(k);
      }
    }
    return keys;
  }

  enumerateKeys() {
    let keys = [];
    let md = this;
    while (md) {
      keys = keys.concat(md.ownKeys());
      md = md.proto || this.realm.mdproto(md.object);
    }
    return new ArrayIterator(keys);
  }
}

export class CowObjectMetadata extends ObjectMetadata {
  constructor(object, realm) {
    super(object, realm);
    this.exclude = {};
  }

  hasOwnProperty(key) {
    return (
      hasProp(this.properties, key) || (hasProp(this.object, key) && !hasProp(this.exclude, key))
    );
  }

  getOwnProperty(key) {
    if (hasProp(this.properties, key)) {
      return this.properties[key];
    }
    if (hasProp(this.object, key) && !hasProp(this.exclude, key)) {
      return this.object[key];
    }
    return undefined;
  }

  setOwnProperty(key, value) {
    if (hasProp(this.exclude, key)) {
      delete this.exclude[key];
    }
    if (!hasProp(this.properties, key)) {
      this.defineProperty(key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return (this.properties[key].value = value);
  }

  delOwnProperty(key) {
    if (hasProp(this.properties, key)) {
      delete this.properties[key];
    }
    return (this.exclude[key] = null);
  }

  isEnumerable(k) {
    if (!super.isEnumerable(k)) {
      return false;
    }
    return !hasProp(this.exclude, k);
  }
}

// 此类防止不需要的属性泄漏到 Realm 的全局对象中
export class RestrictedObjectMetadata extends CowObjectMetadata {
  constructor(object, realm) {
    super(object, realm);
    this.leak = {};
  }

  hasOwnProperty(key) {
    return (
      hasProp(this.properties, key) ||
      (hasProp(this.leak, key) && hasProp(this.object, key) && !hasProp(this.exclude, key))
    );
  }

  getOwnProperty(key) {
    if (hasProp(this.properties, key)) {
      return this.properties[key];
    }
    if (hasProp(this.leak, key) && hasProp(this.object, key) && !hasProp(this.exclude, key)) {
      return this.object[key];
    }
    return undefined;
  }

  isEnumerable(k) {
    if (!super.isEnumerable(k)) {
      return false;
    }
    return hasProp(this.leak, k);
  }
}
