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

Boolean.size = function size() {
  return this.super_.size() + heap.ptrSize;
};

Boolean.prototype.value = function value() {
  return binding.readTagged(this.deref(), offsets.value) ? true : false;
};

Boolean.prototype.rawSize = function rawSize() {
  return Boolean.size();
};

Boolean.prototype.toJSON = function toJSON() {
  return this.value();
};
