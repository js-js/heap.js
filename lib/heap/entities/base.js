var heap = require('../../heap');
var binding = heap.binding;
var constants = heap.constants;
var utils = heap.utils;

function Base(heap, type, ptr) {
  this.heap = heap;
  this.type = type;

  this.smi = null;

  if (ptr instanceof Base) {
    this.smi = ptr.smi;
    this.scope = ptr.scope;
    this.index = ptr.index;
  } else if (typeof ptr === 'number') {
    this.smi = ptr;
    this.scope = null;
    this.index = null;
  } else {
    this.scope = this.heap.currentScope();
    this.index = this.scope.add(ptr);
  }
}
module.exports = Base;

Base.prototype.cast = function cast(map) {
  return this.heap.cast(this, map);
};

Base.prototype.ptr = function ptr() {
  if (this.smi !== null)
    return utils.getPointer(this.smi);

  return this.scope.getPointer(this.index);
};

Base.prototype.deref = function deref() {
  if (this.smi === null)
    return this.scope.deref(this.index);
  else
    return this.smi;
};

Base.prototype.rawSize = function rawSize() {
  return heap.ptrSize + this._rawSize();
};

Base.prototype._rawMap = function _rawMap() {
  var ptr = this.deref();
  if (typeof ptr === 'number')
    return this.heap.maps.smi.deref();

  return binding.readTagged(this.deref(), 0);
};

Base.prototype.map = function map() {
  var ptr = this.deref();
  if (typeof ptr === 'number')
    return this.heap.maps.smi;
  return new heap.entities.Map(this.heap, binding.readTagged(this.deref(), 0));
};

Base.prototype.isSame = function isSame(handle) {
  // Exact match
  var samePtr = utils.cmpPtr(handle.ptr(), 0, this.ptr(), 0);
  if (samePtr)
    return true;

  // Different maps
  var self = binding.readTagged(this.deref(), 0);
  var other = binding.readTagged(handle.deref(), 0);
  if (!binding.isSame(self, other))
    return false;

  if (!this._isSame)
    return true;

  // Polymorphic comparison
  return this.cast()._isSame(handle.cast());
};
