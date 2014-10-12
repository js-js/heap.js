var heap = require('../../heap');
var binding = heap.binding;
var constants = heap.constants;

function Base(heap, type, ptr) {
  this.heap = heap;
  this.type = type;
  this.ptr = ptr;
}
module.exports = Base;

Base.prototype.map = function map() {
  return binding.readTagged(this.ptr, 0);
};

Base.prototype.isSame = function isSame(ptr) {
  var p = ptr.ptr || ptr;
  // Exact match
  if (binding.isSame(this.ptr, p))
    return true;

  var map = this.map();
  var dmap = binding.readTagged(p, 0);

  // Different maps
  if (!binding.isSame(map, dmap))
    return false;

  // Polymorphic comparison
  return this._isSame && this._isSame(p);
};
