var heap = require('../../heap');
var binding = heap.binding;
var Base = heap.entities.Base;

var util = require('util');

function AccessPair(heap, ptr) {
  Base.call(this, heap, 'access-pair', ptr);
}
util.inherits(AccessPair, Base);
module.exports = AccessPair;

var offsets = {
  getter: heap.ptrSize,
  setter: 2 * heap.ptrSize
};
AccessPair.offsets = offsets;

AccessPair.size = function size() {
  return this.super_.size() + 2 * heap.ptrSize;
};

AccessPair.prototype.getter = function getter() {
  return this.heap.wrap(binding.readTagged(this.deref(), offsets.getter));
};

AccessPair.prototype.updateGetter = function updateGetter(handle) {
  binding.writeTagged(this.deref(), handle.deref(), offsets.getter);
};

AccessPair.prototype.setter = function setter() {
  return this.heap.wrap(binding.readTagged(this.deref(), offsets.setter));
};

AccessPair.prototype.updateSetter = function updateSetter(handle) {
  binding.writeTagged(this.deref(), handle.deref(), offsets.setter);
};

AccessPair.prototype.rawSize = function rawSize() {
  return AccessPair.size();
};

AccessPair.prototype.toJSON = function toJSON() {
  return this.value();
};
