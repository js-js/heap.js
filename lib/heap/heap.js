var heap = require('../heap');
var Space = heap.Space;
var Scope = heap.Scope;
var Reference = heap.Reference;
var binding = heap.binding;

var assert = require('assert');
var Buffer = require('buffer').Buffer;

function Heap() {
  this.data = new Space('data', 1024 * 1024);
  this.code = new Space('code', 1024 * 1024);

  this.globals = new Scope(this);
  this.maps = {};

  this.registerMap('map', null);
  this.registerMap('double', 'map');
  this.registerMap('string', 'map');
  this.registerMap('object', 'map');
  this.registerMap('hashmap', 'map');
  this.hole = this.registerMap('hole', null);
}
module.exports = Heap;

Heap.create = function create() {
  return new Heap();
};

Heap.prototype.allocTagged = function allogTagged(type, size) {
  var res = this.data.allocRaw(heap.ptrSize + size);
  var map = this.maps[type];

  if (map)
    map = map.deref();
  else
    map = res;
  binding.writeTagged(res, map, 0);
  return res;
};

Heap.prototype.allocMap = function allocMap(parent) {
  var res = this.allocTagged('map', heap.ptrSize);
  binding.writeTagged(res, parent ? this.maps[parent] : res, 0);
  return res;
};

Heap.prototype.allocDouble = function allocDouble(val) {
  var res = this.allocTagged('double', heap.ptrSize);
  res.writeDoubleLE(val, heap.ptrSize, true);
  return new heap.entities.Double(this, res);
};

Heap.prototype.allocString = function allocString(val) {
  var len = Buffer.byteLength(val);
  var res = this.allocTagged('string', heap.ptrSize + len);

  binding.writeTagged(res, len, heap.ptrSize);
  res.write(val, 2 * heap.ptrSize);

  return new heap.entities.String(this, res);
};

Heap.prototype.allocHashMap = function allocHashMap(size) {
  // NOTE: We allocate twice the `size` to store keys
  var res = this.allocTagged('hashmap', (1 + 2 * size) * heap.ptrSize);

  // Hashmap size
  binding.writeTagged(res, size, heap.ptrSize);

  // Hashmap contents (holes)
  var hole = this.maps.hole.deref();
  for (var i = 0; i < size; i++)
    binding.writeTagged(res, hole, (2 + 2 * i) *  heap.ptrSize);

  return new heap.entities.HashMap(this, res);
};

Heap.prototype.allocObject = function allocObject(size) {
  assert.equal((size & ~(size - 1)), size,
               'size of object should be power of 2');

  var res = this.allocTagged('object', heap.ptrSize);

  // Hashmap
  binding.writeTagged(res, this.allocHashMap(size).ptr, heap.ptrSize);

  return new heap.entities.Object(this, res);
};

Heap.prototype.registerMap = function registerMap(name, parent) {
  var map = this.globals.add(this.allocMap(parent));
  this.maps[name] = map;
  return map;
};

Heap.prototype.checkMap = function checkMap(name, ptr) {
  var map = this.maps[name];
  return map.isSame(ptr, 0);
};

Heap.prototype.isHole = function isHole(ptr) {
  return binding.isSame(ptr, this.maps.hole.deref());
};

Heap.prototype.get = function get(ptr) {
  if (typeof ptr === 'number') {
    return ptr;
  } else if (this.checkMap('double', ptr)) {
    return new heap.entities.Double(this, ptr);
  } else if (this.checkMap('string', ptr)) {
    return new heap.entities.String(this, ptr);
  } else if (this.checkMap('object', ptr)) {
    return new heap.entities.Object(this, ptr);
  } else if (this.checkMap('hole', ptr)) {
    return null;
  } else {
    throw new Error('Unknown heap entity type');
  }
};
