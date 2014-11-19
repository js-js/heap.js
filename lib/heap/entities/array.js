var heap = require('../../heap');
var binding = heap.binding;
var Object = heap.entities.Object;

var util = require('util');

function Array(heap, ptr) {
  Object.call(this, heap, ptr);
  this.type = 'function';
}
util.inherits(Array, Object);
module.exports = Array;

var offsets = {
  length: Object.size()
};
Array.offsets = offsets;

Array.size = function size() {
  return this.super_.size() + heap.ptrSize;
};

Array.prototype.length = function length() {
  return new heap.entities.Code(
      this.heap,
      binding.readTagged(this.deref(), offsets.length));
};

Array.prototype._setLength = function _setLength(len) {
  return binding.writeTagged(this.deref(), len, offsets.length);
};

Array.prototype.rawSize = function rawSize() {
  return Array.size();
};

Array.prototype.toJSON = function toJSON() {
  return Object.prototype.toJSON.call(this, null, []);
};
