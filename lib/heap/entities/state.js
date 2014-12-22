var heap = require('../../heap');
var Base = heap.entities.Base;
var binding = heap.binding;

var util = require('util');

function State(heap, ptr) {
  Base.call(this, heap, 'state', ptr);
}
util.inherits(State, Base);
module.exports = State;

var offsets = {
  global: heap.ptrSize,

  // Those: are just a raw pointers to current page's start/end
  heap: 2 * heap.ptrSize,
  heapLimit: 3 * heap.ptrSize
};
State.offsets = offsets;

State.size = function size() {
  return this.super_.size() + 3 * heap.ptrSize;
};

State.alloc = function alloc(heap) {
  var res = heap.allocTagged('data', 'state', State.size());

  heap.virtualScope(function() {
    var global = heap.allocGlobal().deref();
    binding.writeTagged(res, global, offsets.global);
  }, heap);

  binding.writeTagged(res, heap.spaces.data.startRef, offsets.heap);
  binding.writeTagged(res, heap.spaces.data.limitRef, offsets.heapLimit);

  res = new State(heap, res);
  heap.runPendingGC();
  return res;
};

State.prototype.rawSize = function rawSize() {
  return State.size();
};

State.prototype.global = function global() {
  return this.heap.wrap(binding.readTagged(this.deref(), offsets.global));
};

State.prototype.heap = function heap() {
  return binding.readTagged(this.deref(), offsets.heap);
};

State.prototype.heapLimit = function heapLimit() {
  return binding.readTagged(this.deref(), offsets.heapLimit);
};

State.prototype.toJSON = function toJSON() {
  throw new Error('Converting state to JSON');
};

State.prototype.visit = function visit(cb, ptr) {
  if (!ptr)
    ptr = this.ptr();
  State.super_.prototype.visit.call(this, cb, ptr);

  // Slots
  cb(ptr, offsets.global, 'global');
};
