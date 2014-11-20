var heap = require('../../heap.js');

function Dictionary(field) {
  this.field = field;
  this.type = 'attr-dict';
}
module.exports = Dictionary;

var attrs = {
  enumerable: 0x1,

  'default': 0,
  denseMask: 0
};
Dictionary.attributes = attrs;
Dictionary.prototype.attributes = attrs;

Dictionary.attributes['default'] = Dictionary.attributes.enumerable;

var offsets = {
  itemSize: 3,

  attribute: 0,
  key: 1,
  value: 2
};
Dictionary.offsets = offsets;
Dictionary.prototype.offsets = offsets;

Dictionary.prototype.isDense = function isDense() {
  return false;
};

Dictionary.prototype.size = function size() {
  return this.field.size() / offsets.itemSize;
};

Dictionary.prototype.getAttr = function getAttr(i) {
  return this.field.get(offsets.itemSize * i + offsets.attribute);
};

Dictionary.prototype.getKey = function getKey(i) {
  return this.field.get(offsets.itemSize * i + offsets.key);
};

Dictionary.prototype.getValue = function getValue(i) {
  return this.field.get(offsets.itemSize * i + offsets.value);
};

Dictionary.prototype.setAttr = function setAttr(i, value) {
  return this.field.set(offsets.itemSize * i + offsets.attribute, value);
};

Dictionary.prototype.setKey = function setKey(i, value) {
  return this.field.set(offsets.itemSize * i + offsets.key, value);
};

Dictionary.prototype.setValue = function setValue(i, value) {
  return this.field.set(offsets.itemSize * i + offsets.value, value);
};
