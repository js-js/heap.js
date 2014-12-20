var heap = require('../../heap');
var Base = heap.entities.Base;

var util = require('util');

function Double(heap, ptr) {
  Base.call(this, heap, 'double', ptr);
}
util.inherits(Double, Base);
module.exports = Double;

var offsets = {
  value: heap.ptrSize
};
Double.offsets = offsets;

Double.size = function size() {
  return this.super_.size() + heap.ptrSize;
};

Double.alloc = function alloc(heap, value) {
  var res = heap.allocTagged('data', 'double', Double.size());
  res.writeDoubleLE(value, offsets.value, true);
  return new Double(heap, res);
};

Double.prototype.value = function value() {
  return this.deref().readDoubleLE(offsets.value, true);
};

Double.prototype.rawSize = function rawSize() {
  return Double.size();
};

Double.prototype.toJSON = function toJSON() {
  return this.value();
};
