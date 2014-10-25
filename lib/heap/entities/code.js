var heap = require('../../heap');
var binding = heap.binding;
var Base = heap.entities.Base;

var util = require('util');

function Code(heap, ptr) {
  Base.call(this, heap, 'code', ptr);
}
util.inherits(Code, Base);
module.exports = Code;

var offsets = {
  size: heap.ptrSize,
  code: 2 * heap.ptrSize
};
Code.offsets = offsets;

Code.size = function size(codeSize, offsets) {
  return this.super_.size() + codeSize + (2 + offsets) * heap.ptrSize;
};

Code.prototype.rawSize = function rawSize() {
  return Code.size(this.size(), this.offsetCount());
};

Code.prototype.size = function size() {
  return binding.readTagged(this.deref(), offsets.size);
};

Code.prototype.code = function code() {
  return this.deref().slice(offsets.code, offsets.code + this.size());
};

Code.prototype.offsetCount = function offsetCount() {
  return binding.readTagged(this.deref(), offsets.code + this.size());
};

Code.prototype.offsets = function offsets() {
  var size = this.size();
  var ptr = this.deref();
  var count = binding.readTagged(ptr, Code.offsets.code + size);
  var res = new Array(count);
  var off = Code.offsets.code + heap.ptrSize + size;
  for (var i = 0; i < res.length; i++, off += heap.ptrSize)
    res[i] = binding.readTagged(ptr, off);

  return res;
};

Code.prototype.readSlot = function readSlot(offset) {
  var ptr = binding.readTagged(this.code(), offset);
  return this.heap.wrap(ptr);
};

Code.prototype.toJSON = function toJSON() {
  throw new Error('Converting code to JSON');
};
