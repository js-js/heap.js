var heap = require('../../heap');
var Base = heap.entities.Base;
var binding = heap.binding;

var util = require('util');

function Context(heap, ptr) {
  Base.call(this, heap, 'context', ptr);
}
util.inherits(Context, Base);
module.exports = Context;

var offsets = {
  global: heap.ptrSize,

  // Those: are just a raw pointers to current page's start/end
  heap: 2 * heap.ptrSize,
  heapLimit: 3 * heap.ptrSize
};
Context.offsets = offsets;

Context.size = function size() {
  return this.super_.size() + 3 * heap.ptrSize;
};

Context.prototype.rawSize = function rawSize() {
  return Context.size();
};

Context.prototype.global = function global() {
  return this.heap.wrap(binding.readTagged(this.deref(), offsets.global));
};

Context.prototype.heap = function heap() {
  return binding.readTagged(this.deref(), offsets.heap);
};

Context.prototype.heapLimit = function heapLimit() {
  return binding.readTagged(this.deref(), offsets.heapLimit);
};

Context.prototype.toJSON = function toJSON() {
  throw new Error('Converting context to JSON');
};
