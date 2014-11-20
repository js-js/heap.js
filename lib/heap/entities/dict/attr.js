var heap = require('../../../heap.js');
var BaseDict = heap.entities.dict.Base;

var util = require('util');

function AttrDict(field) {
  BaseDict.call(this, field);
}
util.inherits(AttrDict, BaseDict);
module.exports = AttrDict;

var offsets = {
  itemSize: 3,

  attribute: 0,
  key: 1,
  value: 2
};
AttrDict.offsets = offsets;

AttrDict.prototype.getMeta = function getMeta(i) {
  return {
    attributes: this.field.get(this.offsets.itemSize * i +
                               this.offsets.attribute)
  };
};

AttrDict.prototype.setMeta = function setMeta(i, value) {
  if (value.attributes !== undefined) {
    this.field.set(this.offsets.itemSize * i + this.offsets.attribute,
                   value.attributes);
  }
};
