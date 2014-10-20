var heap = require('../../heap');
var binding = heap.binding;
var Base = heap.entities.Base;

var util = require('util');

function Boolean(heap, ptr) {
  Base.call(this, heap, 'boolean', ptr);
}
util.inherits(Boolean, Base);
module.exports = Boolean;

var offsets = {
  value: heap.ptrSize
};
Boolean.offsets = offsets;

Boolean.prototype.value = function value() {
  return binding.readTagged(this.deref(), offsets.value) ? true : false;
};

Boolean.prototype._rawSize = function _rawSize() {
  return heap.ptrSize;
};
