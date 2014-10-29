var heap = require('../../heap');
var binding = heap.binding;
var utils = heap.utils;
var Base = heap.entities.Base;

var util = require('util');

function Map(heap, ptr) {
  Base.call(this, heap, 'map', ptr);
}
util.inherits(Map, Base);
module.exports = Map;

var offsets = {
  parent: heap.ptrSize,
  proto: 2 * heap.ptrSize
};
Map.offsets = offsets;

Map.size = function size() {
  return this.super_.size() + 2 * heap.ptrSize;
};

Map.prototype.rawSize = function rawSize() {
  return Map.size();
};

Map.prototype.parent = function parent() {
  return new Map(this.heap, binding.readTagged(this.deref(), offsets.parent));
};

Map.prototype.proto = function proto() {
  var ptr = binding.readTagged(this.deref(), offsets.proto);
  if (binding.isSame(ptr, this.heap.hole.deref()))
    return this.heap.hole;

  return new heap.entities.Object(this.heap, ptr);
};

Map.prototype._setProto = function _setProto(proto) {
  binding.writeTagged(this.deref(), proto.deref(), Map.offsets.proto);
};

Map.prototype.isSame = function isSame(handle) {
  // Exact match
  return utils.cmpPtr(handle.ptr(), 0, this.ptr(), 0);
};

Map.prototype.toJSON = function toJSON() {
  throw new Error('Converting map to JSON');
};
