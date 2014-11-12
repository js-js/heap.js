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

var offsets = {
  map: 0
};
Base.offsets = offsets;

Base.size = function size() {
  // Map
  return heap.ptrSize;
};

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
  return Base.size();
};

Base.prototype._rawMap = function _rawMap() {
  var ptr = this.deref();
  if (typeof ptr === 'number')
    return this.heap.maps.smi.deref();

  return binding.readTagged(this.deref(), offsets.map);
};

Base.prototype.map = function map() {
  var ptr = this.deref();
  if (typeof ptr === 'number')
    return this.heap.maps.smi;
  return new heap.entities.Map(this.heap,
                               binding.readTagged(this.deref(), offsets.map));
};

Base.prototype._updateMap = function _updateMap(map) {
  var ptr = this.deref();
  if (typeof ptr === 'number')
    return;
  binding.writeTagged(ptr, map.deref(), offsets.map);
};

Base.prototype.isSame = function isSame(handle) {
  if (this.smi !== null || handle.smi !== null)
    return this.smi === handle.smi;

  // Exact match
  var samePtr = utils.cmpPtr(handle.ptr(), 0, this.ptr(), 0);
  if (samePtr)
    return true;

  // Different maps
  var self = binding.readTagged(this.deref(), offsets.map);
  var other = binding.readTagged(handle.deref(), offsets.map);
  if (!binding.isSame(self, other))
    return false;

  if (!this._isSame)
    return true;

  // Polymorphic comparison
  return this.cast()._isSame(handle.cast());
};

Base.prototype.move = function move(scope) {
  this.index = scope.add(this.deref());
  this.scope = scope;
};

Base.prototype.coerceTo = function coerceTo(map) {
  if (typeof map === 'string')
    map = this.heap.maps[map];

  // Same map - no coercion required
  if (this.map().isSame(map))
    return this;

  if (this.heap.checkMap('boolean', map)) {
    var res;
    if (this.type === 'smi' || this.type === 'double')
      res = !!this.value();
    else if (this.type === 'string')
      res = !!this.data().toString();
    // TODO(indutny): find time to check it
    else
      res = true;

    return res ? this.heap.true_ : this.heap.false_;
  } else {
    throw new Error('Coercion is not fully implemented yet');
  }
};

Base.prototype.toJSON = function toJSON() {
  return this.cast().toJSON();
};

Base.prototype.get = function get() {
  if (this.map().isObject())
    return this.heap.undef;

  throw new Error('Can\'t access properties of non-object');
};

Base.prototype.set = function set() {
  if (this.map().isObject())
    return;

  throw new Error('Can\'t access properties of non-object');
};
