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
  hash: 2 * heap.ptrSize,
  data: 3 * heap.ptrSize
};
String.offsets = offsets;

String.size = function size(len) {
  return this.super_.size() + 2 * heap.ptrSize + len;
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
  var hash = this._hash(self);
  var otherHash = handle._hash(other);
  if (!this.heap.isHole(hash) && !this.heap.isHole(otherHash)) {
    if (hash.value() !== otherHash.value())
      return false;
  }

  for (var i = 0; i < len; i++)
    if (self[offsets.data + i] !== other[offsets.data + i])
      return false;

  return true;
};

String.prototype._hash = function _hash(ptr) {
  return this.heap.wrap(binding.readTagged(ptr, offsets.hash)).cast();
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
  var cached = this._hash(ptr);
  if (!this.heap.isHole(cached))
    return cached.value();

  var v = heap.utils.hash(ptr, offsets.data, offsets.data + this._length(ptr));
  // Mask high bits so it'll fit into tagged field
  v &= 0x7fffffff;
  binding.writeTagged(ptr, v, offsets.hash);
  return v;
};

String.prototype.toJSON = function toJSON() {
  return this.toString();
};
