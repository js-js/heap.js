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

Map.prototype._rawSize = function _rawSize() {
  // Parent map
  return heap.ptrSize;
};

Map.prototype.parent = function parent() {
  return new Map(this.heap, binding.readTagged(this.deref(), offsets.parent));
};

Map.prototype.isSame = function isSame(handle) {
  // Exact match
  return utils.cmpPtr(handle.ptr(), 0, this.ptr(), 0);
};
