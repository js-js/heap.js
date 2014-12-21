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
  attributes: heap.ptrSize,
  getter: 2 * heap.ptrSize,
  setter: 3 * heap.ptrSize
};
AccessPair.offsets = offsets;

var attrs = {
  enumerable: 0x1,

  'default': 0,
  denseMask: 0
};
AccessPair.attributes = attrs;
AccessPair.attributes.default = AccessPair.attributes.enumerable;
AccessPair.attributes.denseMask = AccessPair.attributes.enumerable;

AccessPair.size = function size() {
  return this.super_.size() + 3 * heap.ptrSize;
};

AccessPair.alloc = function alloc(heap, pair) {
  var res = heap.allocTagged('data', 'access-pair', AccessPair.size());

  if (!pair)
    pair = {};

  var attrs = pair.attributes || heap.smi(AccessPair.attributes['default']);
  binding.writeTagged(res, attrs.deref(), offsets.attributes);

  binding.writeTagged(res, (pair.getter || heap.hole).deref(), offsets.getter);
  binding.writeTagged(res, (pair.setter || heap.hole).deref(), offsets.setter);

  return new AccessPair(heap, res);
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

AccessPair.prototype.visit = function visit(cb, ptr) {
  if (!ptr)
    ptr = this.ptr();
  AccessPair.super_.prototype.visit.call(this, cb, ptr);

  cb(ptr, offsets.attributes, 'attributes');
  cb(ptr, offsets.getter, 'getter');
  cb(ptr, offsets.setter, 'setter');
};
