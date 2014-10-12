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

String.prototype._isSame = function _isSame(ptr) {
  var other = new String(this.heap, ptr);

  var len = this.length();
  if (len !== other.length())
    return false;

  for (var i = 0; i < len; i++)
    if (this.ptr[DATA_OFF + i] !== ptr[DATA_OFF + i])
      return false;

  return true;
};

String.prototype.length = function length() {
  return binding.readTagged(this.ptr, 8);
};

String.prototype.data = function data() {
  return this.ptr.slice(heap.ptrSize * 2);
};

String.prototype.toString = function toString() {
  return this.ptr.slice(DATA_OFF, DATA_OFF + this.length()).toString();
};

String.prototype.hash = function hash() {
  return heap.utils.hash(this.ptr, DATA_OFF, DATA_OFF + this.length());
};
