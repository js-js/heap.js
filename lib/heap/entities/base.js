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

Base.prototype.ptr = function ptr() {
  if (this.smi !== null)
    return null;

  var off = this.index * heap.ptrSize;
  return this.scope.storage.slice(off, off + heap.ptrSize);
};

Base.prototype.deref = function deref() {
  if (this.smi === null)
    return binding.readTagged(this.scope.storage, this.index * heap.ptrSize);
  else
    return this.smi;
};

Base.prototype.rawSize = function rawSize() {
  return heap.ptrSize + this._rawSize();
};

Base.prototype.map = function map() {
  var ptr = this.deref();
  if (typeof ptr === 'number')
    return this.heap.maps.smi;
  return new heap.entities.Map(this.heap, binding.readTagged(this.deref(), 0));
};

Base.prototype.isSame = function isSame(handle) {
  // Exact match
  var samePtr = utils.cmpPtr(
      handle.scope.storage,
      handle.index * heap.ptrSize,
      this.scope.storage,
      this.index * heap.ptrSize);
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
  return this.heap.cast(this)._isSame(this.heap.cast(handle));
};
