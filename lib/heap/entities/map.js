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
  proto: 2 * heap.ptrSize,
  flags: 3 * heap.ptrSize,
  edges: 4 * heap.ptrSize
};
Map.offsets = offsets;

var flags = {
  object: 1
};
Map.flags = flags;

Map.size = function size() {
  return this.super_.size() + 4 * heap.ptrSize;
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

Map.prototype.flags = function flags() {
  return binding.readTagged(this.deref(), offsets.flags);
};

Map.prototype.edges = function edges() {
  var ptr = binding.readTagged(this.deref(), offsets.edges);
  if (binding.isSame(ptr, this.heap.hole.deref()))
    return this.heap.hole;
  return new heap.entities.Object(this.heap, ptr);
};

Map.prototype._setEdges = function _setEdges(edges) {
  binding.writeTagged(this.deref(), edges.deref(), Map.offsets.edges);
};

Map.prototype.transition = function transition(key) {
  var edges = this.edges();
  if (this.heap.isHole(edges))
    return;

  var trans = edges.get(key);
  if (!this.heap.isUndef(trans))
    return trans;

  // Allocate new transition map
  var map = this.heap.allocMap(this.parent(), this.flags());

  // Share prototype
  map._setProto(this.proto());

  // Store transition
  edges.set(key, map, true);
  return edges;
};

Map.prototype.isSame = function isSame(handle) {
  // Exact match
  return utils.cmpPtr(handle.ptr(), 0, this.ptr(), 0);
};

Map.prototype.toJSON = function toJSON() {
  throw new Error('Converting map to JSON');
};
