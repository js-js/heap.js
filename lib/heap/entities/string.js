var heap = require('../../heap');
var Base = heap.entities.Base;
var binding = heap.binding;
var utils = heap.utils;

var util = require('util');

function String(heap, ptr) {
  Base.call(this, heap, 'string', ptr);
}
util.inherits(String, Base);
module.exports = String;

var offsets = {
  length: heap.ptrSize,
  data: 2 * heap.ptrSize
};
String.offsets = offsets;

String.size = function size(len) {
  return this.super_.size() + heap.ptrSize + len;
};

String.prototype.rawSize = function rawSize() {
  return String.size(this.length());
};

String.prototype._isSame = function _isSame(handle) {
  var len = this.length();
  if (len !== handle.length())
    return false;

  var self = this.deref();
  var other = handle.deref();
  for (var i = 0; i < len; i++)
    if (self[offsets.data + i] !== other[offsets.data + i])
      return false;

  return true;
};

String.prototype._length = function _length(ptr) {
  return binding.readTagged(ptr, offsets.length);
};

String.prototype.length = function length() {
  return this._length(this.deref());
};

String.prototype.data = function data() {
  return this.deref().slice(offsets.data * 2);
};

String.prototype.toString = function toString() {
  var ptr = this.deref();
  return ptr.slice(offsets.data, offsets.data + this._length(ptr)).toString();
};

String.prototype.hash = function hash() {
  var ptr = this.deref();
  return heap.utils.hash(ptr, offsets.data, offsets.data + this._length(ptr));
};

String.prototype.toJSON = function toJSON() {
  return this.toString();
};
