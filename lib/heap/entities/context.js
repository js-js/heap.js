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
  self: heap.ptrSize,
  global: 2 * heap.ptrSize,
  fn: 3 * heap.ptrSize,

  // Those: are just a raw pointers to current page's start/end
  heap: 4 * heap.ptrSize,
  heapLimit: 5 * heap.ptrSize
};
Context.offsets = offsets;

Context.size = function size() {
  return this.super_.size() + 5 * heap.ptrSize;
};

Context.prototype.rawSize = function rawSize() {
  return Context.size();
};

Context.prototype.self = function self() {
  return this.heap.wrap(binding.readTagged(this.deref(), offsets.self));
};

Context.prototype.updateSelf = function updateSelf(self) {
  binding.writeTagged(this.deref(), self.deref(), offsets.self);
};

Context.prototype.global = function global() {
  return this.heap.wrap(binding.readTagged(this.deref(), offsets.global));
};

Context.prototype.fn = function fn() {
  return this.heap.wrap(binding.readTagged(this.deref(), offsets.fn));
};

Context.prototype.heap = function heap() {
  return binding.readTagged(this.deref(), offsets.heap);
};

Context.prototype.heapLimit = function heapLimit() {
  return binding.readTagged(this.deref(), offsets.heapLimit);
};
