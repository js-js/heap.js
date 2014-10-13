var heap = require('../../heap');
var Base = heap.entities.Base;
var binding = heap.binding;
var utils = heap.utils;

var util = require('util');

var DATA_OFF = heap.ptrSize * 2;

function String(heap, ptr) {
  Base.call(this, heap, 'string', ptr);
}
util.inherits(String, Base);
module.exports = String;

String.prototype._rawSize = function _rawSize() {
  return heap.ptrSize + this.length();
};

String.prototype._isSame = function _isSame(handle) {
  var len = this.length();
  if (len !== handle.length())
    return false;

  var self = this.deref();
  var other = handle.deref();
  for (var i = 0; i < len; i++)
    if (self[DATA_OFF + i] !== other[DATA_OFF + i])
      return false;

  return true;
};

String.prototype._length = function _length(ptr) {
  return binding.readTagged(ptr, 8);
};

String.prototype.length = function length() {
  return this._length(this.deref());
};

String.prototype.data = function data() {
  return this.deref().slice(heap.ptrSize * 2);
};

String.prototype.toString = function toString() {
  var ptr = this.deref();
  return ptr.slice(DATA_OFF, DATA_OFF + this._length(ptr)).toString();
};

String.prototype.hash = function hash() {
  var ptr = this.deref();
  return heap.utils.hash(ptr, DATA_OFF, DATA_OFF + this._length(ptr));
};
