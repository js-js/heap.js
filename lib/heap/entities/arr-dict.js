var heap = require('../../heap.js');
var AttrDict = heap.entities.AttrDict;

function ArrayDict(field) {
  this.field = field;
  this.type = 'array-dict';
}
module.exports = ArrayDict;

var offsets = {
  itemSize: 1,

  value: 0
};
ArrayDict.offsets = offsets;
ArrayDict.prototype.offsets = offsets;

var attributes = {
  'default': AttrDict.attributes.enumerable,
  mask: 0
};
ArrayDict.attributes = attributes;
ArrayDict.attributes.mask = AttrDict.attributes.enumerable;

ArrayDict.prototype.isDense = function isDense() {
  return true;
};

ArrayDict.prototype.size = function size() {
  return this.field.size() / offsets.itemSize;
};

ArrayDict.prototype.getKey = function getKey(i) {
  return this.field.heap.smi(i);
};

ArrayDict.prototype.getAttr = function getAttr(i) {
  return this.field.heap.smi(attributes['default']);
};

ArrayDict.prototype.getValue = function getValue(i) {
  return this.field.get(offsets.itemSize * i + offsets.value);
};

ArrayDict.prototype.setKey = function setKey() {
};

ArrayDict.prototype.setAttr = function setAttr() {
};

ArrayDict.prototype.setValue = function setValue(i, value) {
  return this.field.set(offsets.itemSize * i + offsets.value, value);
};
