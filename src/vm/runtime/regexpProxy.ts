// @ts-nocheck
const { CowObjectMetadata } = require("./metadata");
const { defProp } = require("./util");

class RegExpProxy {
  static initClass() {
    this.__name__ = "RegExp";
  }

  constructor(regexp, realm) {
    this.regexp = regexp;
    this.lastIndex = 0;
    const md = new CowObjectMetadata(this, realm);
    md.proto = realm.getNativeMetadata(RegExp.prototype);
    md.defineProperty("global", { value: regexp.global });
    md.defineProperty("ignoreCase", { value: regexp.ignoreCase });
    md.defineProperty("multiline", { value: regexp.multiline });
    md.defineProperty("source", { value: regexp.source });
    defProp(this, "__md__", {
      value: md,
      writable: true,
    });
  }
}
RegExpProxy.initClass();

module.exports = RegExpProxy;
