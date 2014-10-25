var heap = require('../../heap');
var utils = heap.utils;
var Base = heap.entities.Base;

var util = require('util');

function Map(heap, ptr) {
  Base.call(this, heap, 'map', ptr);
}
util.inherits(Map, Base);
module.exports = Map;

var offsets = {
  parent: heap.ptrSize
};
Map.offsets = offsets;

Map.size = function size() {
  return this.super_.size() + heap.ptrSize;
};

Map.prototype.rawSize = function rawSize() {
  return Map.size();
};

Map.prototype.parent = function parent() {
  return new Map(this.heap, binding.readTagged(this.deref(), offsets.parent));
};

Map.prototype.isSame = function isSame(handle) {
  // Exact match
  return utils.cmpPtr(handle.ptr(), 0, this.ptr(), 0);
};

Map.prototype.toJSON = function toJSON() {
  throw new Error('Converting map to JSON');
};
