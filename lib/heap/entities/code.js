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
  offsetCount: 2 * heap.ptrSize,
  weakCount: 3 * heap.ptrSize,
  code: 4 * heap.ptrSize
};
Code.offsets = offsets;

Code.size = function size(codeSize, offsets, weak) {
  if (codeSize % heap.ptrSize !== 0)
    codeSize + heap.ptrSize - codeSize % heap.ptrSize;
  return this.super_.size() +
         (3 + offsets + weak) * heap.ptrSize +
         codeSize;
};

Code.prototype.rawSize = function rawSize() {
  return Code.size(this.alignedSize(), this.offsetCount(), this.weakCount());
};

Code.prototype.size = function size() {
  return binding.readTagged(this.deref(), offsets.size);
};

Code.prototype.alignedSize = function alignedSize() {
  var size = this.size();
  if (size % heap.ptrSize !== 0)
    size += heap.ptrSize - size % heap.ptrSize;
  return size;
};

Code.prototype.code = function code() {
  return this.deref().slice(offsets.code, offsets.code + this.size());
};

Code.prototype.offsetCount = function offsetCount(ptr) {
  return binding.readTagged(ptr || this.deref(), offsets.offsetCount);
};

Code.prototype.weakCount = function weakCount(ptr) {
  return binding.readTagged(ptr || this.deref(), offsets.weakCount);
};

Code.prototype.offsets = function offsets() {
  var size = this.alignedSize();
  var ptr = this.deref();
  var count = this.offsetCount(ptr);
  var res = new Array(count);
  var off = Code.offsets.code + size;
  for (var i = 0; i < res.length; i++, off += heap.ptrSize)
    res[i] = binding.readTagged(ptr, off);

  return res;
};

Code.prototype.weakOffsets = function offsets() {
  var size = this.alignedSize();
  var ptr = this.deref();
  var off = this.offsetCount(ptr);
  var count = this.weakCount(ptr);
  var res = new Array(count);
  var off = Code.offsets.code + size + off * heap.ptrSize;
  for (var i = 0; i < res.length; i++, off += heap.ptrSize)
    res[i] = binding.readTagged(ptr, off);

  return res;
};

Code.prototype.references = function references() {
  var ptr = this.deref();
  return this.offsets().map(function(off) {
    return this.heap.wrap(binding.readTagged(ptr, offsets.code + off));
  }, this);
};

Code.prototype.weakReferences = function weakReferences() {
  var ptr = this.deref();
  return this.weakOffsets().map(function(off) {
    return this.heap.wrap(binding.readTagged(ptr, offsets.code + off));
  }, this);
};

Code.prototype.readSlot = function readSlot(offset) {
  var ptr = binding.readTagged(this.code(), offset);
  return this.heap.wrap(ptr);
};

Code.prototype.toJSON = function toJSON() {
  throw new Error('Converting code to JSON');
};
