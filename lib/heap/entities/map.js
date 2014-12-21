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
  proto: 1 * heap.ptrSize,
  flags: 2 * heap.ptrSize,
  edges: 3 * heap.ptrSize,
  transitionCount: 4 * heap.ptrSize
};
Map.offsets = offsets;

var flags = {
  object: 0x01,
  fn: 0x02,
  transition: 0x04,
  megamorphic: 0x08
};
Map.flags = flags;

Map.maxTransitions = 7;
Map.maxTransitionHash = 64;

Map.size = function size() {
  return this.super_.size() + 4 * heap.ptrSize;
};

Map.prototype.rawSize = function rawSize() {
  return Map.size();
};

Map.prototype.proto = function proto() {
  var ptr = binding.readTagged(this.deref(), offsets.proto);
  if (binding.isSame(ptr, this.heap.hole.deref()))
    return this.heap.hole;

  return new heap.entities.Object(this.heap, ptr);
};

Map.prototype._setProto = function _setProto(proto) {
  binding.writeTagged(this.deref(), proto.deref(), offsets.proto);
};

Map.prototype.flags = function flags() {
  return binding.readTagged(this.deref(), offsets.flags);
};

Map.prototype.isObject = function isObject() {
  return (this.flags() & Map.flags.object) !== 0;
};

Map.prototype.isFunction = function isFunction() {
  return (this.flags() & Map.flags.fn) !== 0;
};

Map.prototype.canTransition = function canTransition() {
  return (this.flags() & Map.flags.transition) !== 0;
};

Map.prototype.isMegamorphic = function isMegamorphic() {
  return (this.flags() & Map.flags.megamorphic) !== 0;
};

Map.prototype.transitionCount = function transitionCount() {
  return binding.readTagged(this.deref(), offsets.transitionCount);
};

Map.prototype._updateTransitionCount = function _updateTransitionCount(smi) {
  binding.writeTagged(this.deref(), smi, offsets.transitionCount);
};

Map.prototype.edges = function edges() {
  var ptr = binding.readTagged(this.deref(), offsets.edges);
  if (binding.isSame(ptr, this.heap.hole.deref()))
    return this.heap.hole;
  return new heap.entities.Object(this.heap, ptr);
};

Map.prototype._setEdges = function _setEdges(edges) {
  binding.writeTagged(this.deref(), edges.deref(), offsets.edges);
};

Map.prototype.clone = function clone(flags) {
  // Allocate new transition map
  var map = this.heap.allocMap(typeof flags === 'undefined' ? this.flags() :
                                                              flags);

  // Share prototype
  map._setProto(this.proto());

  return map;
};

Map.prototype.transition = function transition(key, object) {
  // Transition is disabled
  if (!this.canTransition())
    return;

  // Megamorphic entity - always mutate map on new property
  if (this.isMegamorphic())
    return this.clone();

  var tc = this.transitionCount();
  if (this.transitionCount() >= Map.maxTransitions)
    return;

  var edges = this.edges();
  if (edges.isHole())
    return;

  var edge = edges.get(key);
  if (!edge.isUndef())
    return edge;

  var flags = this.flags();

  // Transitions limit reached - create a new map and return
  tc++;
  if (edges.dict().size() >= Map.maxTransitionHash ||
      tc >= Map.maxTransitions) {
    flags &= ~Map.flags.transition;
    var map = this.clone(flags);
    map._updateTransitionCount(tc);
    return map;
  }

  // Probe global transitions first, may be there is already a map
  // for the current object:
  //       AB
  //    /      \
  // A           ABC
  //    \     ...
  //       AC
  var keys = object.keys();
  edge = this.heap.transitions.get(keys);
  if (!edge.isUndef())
    return edge;

  // Allocate new transition map
  var map = this.clone(flags);
  map._updateTransitionCount(tc);

  // Store transition
  edges.set(key, map, {
    noTransition: true
  });
  this.heap.transitions.set(keys, map);

  return map;
};

Map.prototype.isSame = function isSame(handle) {
  // Exact match
  return utils.cmpPtr(handle.ptr(), 0, this.ptr(), 0);
};

Map.prototype.toJSON = function toJSON() {
  throw new Error('Converting map to JSON');
};

Map.prototype.visit = function visit(cb, ptr) {
  if (!ptr)
    ptr = this.ptr();
  Map.super_.prototype.visit.call(this, cb, ptr);

  // Prototype
  cb(ptr, offsets.proto, 'prototype');
  // Edges
  cb(ptr, offsets.edges, 'edges');
};
