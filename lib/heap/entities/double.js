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

Double.prototype.value = function value() {
  return this.deref().readDoubleLE(offsets.value, true);
};

Double.prototype._rawSize = function _rawSize() {
  return heap.ptrSize;
};
