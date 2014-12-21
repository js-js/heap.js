var heap = require('../../../heap.js');

function BaseDict(field) {
  this.field = field;
  this.offsets = this.constructor.offsets;
}
module.exports = BaseDict;

BaseDict.prototype.size = function size() {
  return this.field.size() / this.offsets.itemSize;
};

BaseDict.prototype.getKey = function getKey(i) {
  return this.field.get(this.offsets.itemSize * i + this.offsets.key);
};

BaseDict.prototype.getValue = function getValue(i) {
  return this.field.get(this.offsets.itemSize * i + this.offsets.value);
};

BaseDict.prototype.setKey = function setKey(i, key) {
  this.field.set(this.offsets.itemSize * i + this.offsets.key, key);
};

BaseDict.prototype.setValue = function setValue(i, value) {
  this.field.set(this.offsets.itemSize * i + this.offsets.value, value);
};
