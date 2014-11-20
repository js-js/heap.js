var heap = require('../../../heap.js');

function BaseDict(field) {
  this.field = field;
  this.offsets = this.constructor.offsets;
}
module.exports = BaseDict;

var attrs = {
  enumerable: 0x1,

  'default': 0,
  denseMask: 0
};
BaseDict.attributes = attrs;
BaseDict.prototype.attributes = attrs;
BaseDict.attributes.default = BaseDict.attributes.enumerable;
BaseDict.attributes.denseMask = BaseDict.attributes.enumerable;

BaseDict.prototype.size = function size() {
  return this.field.size() / this.offsets.itemSize;
};

BaseDict.prototype.getKey = function getKey(i) {
  return this.field.get(this.offsets.itemSize * i + this.offsets.key);
};

BaseDict.prototype.getMeta = function getMeta(i) {
  throw new Error('Not implemented');
};

BaseDict.prototype.getValue = function getValue(i) {
  return this.field.get(this.offsets.itemSize * i + this.offsets.value);
};

BaseDict.prototype.setKey = function setKey(i, key) {
  this.field.set(this.offsets.itemSize * i + this.offsets.key, key);
};

BaseDict.prototype.setMeta = function setMeta() {
  throw new Error('Not implemented');
};

BaseDict.prototype.setValue = function setValue(i, value) {
  this.field.set(this.offsets.itemSize * i + this.offsets.value, value);
};
