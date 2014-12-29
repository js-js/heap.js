var heap = require('../../heap');
var binding = heap.binding;
var constants = heap.constants;
var utils = heap.utils;

var assert = require('assert');

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

Base.prototype.isHole = function isHole() {
  return this.heap.isHole(this);
};

Base.prototype.isUndef = function isUndef() {
  return this.heap.isUndef(this);
};

Base.prototype.isNull = function isNull() {
  return this.heap.isNull(this);
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
  var index = this.index;
  var oldScope = this.scope;

  this.index = scope.add(this.deref());
  this.scope = scope;

  oldScope.replace(index, this.heap.hole.deref());
};

Base.prototype.copy = function copy(scope) {
  var clone;
  if (this.constructor === Base)
    clone = new this.constructor(this.heap, this.type, this);
  else
    clone = new this.constructor(this.heap, this);

  clone.index = scope.add(clone.deref());
  clone.scope = scope;

  return clone;
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

Base.prototype.visit = function visit(cb) {
  // TODO(indutny): technically we could visit map here, but we do it in
  // mark compact
};

//
// ES Type Coercion routines
//
//

Base.prototype.getValue = function getValue() {
  // TODO(indutny): implement me
  return this;
};

Base.prototype.toPrimitive = function toPrimitive() {
  // TODO(indutny): implement me
  assert(this.type === 'oddball' || this.type === 'smi' ||
         this.type === 'double' || this.type === 'boolean' ||
         this.type === 'string');
  return this;
};

Base.prototype.toNumber = function toNumber() {
  if (this.type === 'boolean')
    return this.heap.smi(this.value() ? 1 : 0);
  else if (this.type === 'double' || this.type === 'smi')
    return this;
  else if (this.type === 'string')
    return this._stringToNumber();
  else if (this.isUndef())
    return this.heap.allocDouble(NaN);
  else if (this.isNull())
    return this.heap.smi(0);
  else
    return this.toPrimitive().toNumber();
};

Base.prototype._stringToNumber = function _stringToNumber() {
  // TODO(indutny): Implement properly for self hosting
  return +this.value();
};

Base.prototype.toString = function toString() {
  if (this.type === 'string')
    return this;
  else if (this.type === 'boolean')
    return this.value() ? 'true' : 'false';
  else if (this.type === 'double' || this.type === 'smi')
    return this._numberToString();
  else if (this.isUndef())
    return this.heap.allocString('undefined');
  else if (this.isNull())
    return this.heap.allocString('null');
  else
    return this.toPrimitive().toString();
};

Base.prototype._numberToString = function _numberToString() {
  var val = this.value();
  if (val === NaN)
    return this.heap.allocString('NaN');
  else if (val === +0 || val === -0)
    return this.heap.allocString('0');

  var res = '';
  if (val < 0) {
    res += '-';
    val = -val;
  }

  // TODO(indutny): needs to be reimplemented for self hosting
  return this.heap.allocString(res + val.toString());
};

//
// Binary operations
//

Base.prototype.add = function add(other) {
  var left = this.getValue().toPrimitive();
  var right = other.getValue().toPrimitive();
  if (left.type === 'string' && right.type !== 'string') {
    right = right.toString();
  } else if (right.type === 'string' && left.type !== 'string') {
    left = left.toString();
  } else if (left.type !== 'string' && right.type !== 'string') {
    left = left.toNumber();
    right = right.toNumber();

    // We do not optimize smi+smi yet
    // (Required for self-hosting)
    if (right.type === 'smi')
      right = this.heap.allocDouble(right.value());
    if (left.type === 'smi')
      left = this.heap.allocDouble(left.value());
  }

  assert.equal(left.type, right.type);
  return left._add(right);
};

var numberOps = [ 'sub', 'mul', 'div', 'mod' ];
numberOps.forEach(function(op) {
  Base.prototype[op] = function numberOp(other) {
    var left = this.getValue().toNumber();
    var right = other.getValue().toNumber();

    // We do not optimize smi+smi yet
    // (Required for self-hosting)
    if (right.type === 'smi')
      right = this.heap.allocDouble(right.value());
    if (left.type === 'smi')
      left = this.heap.allocDouble(left.value());

    assert.equal(left.type, right.type);
    return left['_' + op](right);
  };
});
