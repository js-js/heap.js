var heap = require('../../../heap.js');
var BaseDict = heap.entities.dict.Base;

var util = require('util');

function ArrayDict(field) {
  BaseDict.call(this, field);
}
util.inherits(ArrayDict, BaseDict);
module.exports = ArrayDict;

var offsets = {
  itemSize: 1,

  value: 0
};
ArrayDict.offsets = offsets;

ArrayDict.prototype.getKey = function getKey(i) {
  return this.field.heap.smi(i);
};

ArrayDict.prototype.getMeta = function getMeta(i) {
  return {
    attributes: this.field.heap.smi(this.attributes['default'])
  };
};

ArrayDict.prototype.setKey = function setKey() {
};

ArrayDict.prototype.setMeta = function setMeta() {
};
