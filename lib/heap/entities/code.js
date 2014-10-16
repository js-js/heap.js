var heap = require('../../heap');
var binding = heap.binding;
var Base = heap.entities.Base;

var util = require('util');

function Code(heap, ptr) {
  Base.call(this, heap, 'code', ptr);
}
util.inherits(Code, Base);
module.exports = Code;

Code.prototype._rawSize = function _rawSize() {
  return this.size() + (this.offsetCount() + 2) * heap.ptrSize;
};

Code.prototype.size = function size() {
  return binding.readTagged(this.deref(), heap.ptrSize);
};

Code.prototype.code = function code() {
  return this.deref().slice(2 * heap.ptrSize,
                            2 * heap.ptrSize + this.size());
};

Code.prototype.offsetCount = function offsetCount() {
  return binding.readTagged(this.deref(), 2 * heap.ptrSize + this.size());
};

Code.prototype.offsets = function offsets() {
  var size = this.size();
  var ptr = this.deref();
  var count = binding.readTagged(ptr, 2 * heap.ptrSize + size);
  var res = new Array(count);
  var off = 3 * heap.ptrSize + size;
  for (var i = 0; i < res.length; i++, off += heap.ptrSize)
    res[i] = binding.readTagged(ptr, off);

  return res;
};
