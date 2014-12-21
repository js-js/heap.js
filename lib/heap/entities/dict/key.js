var heap = require('../../../heap.js');
var BaseDict = heap.entities.dict.Base;

var util = require('util');

function KeyDict(field) {
  BaseDict.call(this, field);
}
util.inherits(KeyDict, BaseDict);
module.exports = KeyDict;

var offsets = {
  itemSize: 2,

  key: 0,
  value: 1
};
KeyDict.offsets = offsets;
