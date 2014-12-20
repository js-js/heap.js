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

Boolean.alloc = function alloc(heap, value) {
  // Use cached boolean
  if (value && heap.true_)
    return heap.true_;
  if (!value && heap.false_)
    return heap.false_;

  var res = heap.allocTagged('data', 'boolean', Boolean.size());

  binding.writeTagged(res, value ? 1 : 0, offsets.value);

  return new Boolean(heap, res);
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
