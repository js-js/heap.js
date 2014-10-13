var heap = require('../heap');
var Space = heap.Space;
var Scope = heap.Scope;
var MarkCopy = heap.MarkCopy;
var Visitor = heap.Visitor;
var binding = heap.binding;

var assert = require('assert');
var Buffer = require('buffer').Buffer;

function Heap() {
  this.data = new Space(this, 'data', 1024 * 1024);
  this.code = new Space(this, 'code', 1024 * 1024);

  this.collector = new MarkCopy(this);
  this.visitor = new Visitor(this);

  this.scopes = [];
  this.globals = new Scope(this);
  this.globals.enter();

  this.maps = {};
  this.registerMap('map', null);
  this.registerMap('hashmap', null);
  this.registerMap('object', 'map');
  this.registerMap('code', 'map');
  this.registerMap('smi', 'object');
  this.registerMap('double', 'object');
  this.registerMap('string', 'object');
  this.registerMap('function', 'object');
  this.hole = this.registerMap('hole', null);
}
module.exports = Heap;

Heap.create = function create() {
  return new Heap();
};

Heap.prototype.scope = function scope(cb, ctx) {
  var scope = new Scope(this);
  scope.enter();

  var res = cb.call(ctx, scope);
  scope.leave();

  return res;
};

Heap.prototype.enterScope = function enterScope(scope) {
  this.scopes.push(scope);
};

Heap.prototype.leaveScope = function leaveScope(scope) {
  for (var i = this.scopes.length - 1; i >= 0; i--)
    if (this.scopes[i] === scope)
      return this.scopes.splice(i, 1);
};

Heap.prototype.currentScope = function currentScope() {
  return this.scopes[this.scopes.length - 1];
};

Heap.prototype.smi = function smi(value) {
  return new heap.entities.Smi(this, value);
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
  // TODO(indutny): separate space for maps?
  var res = this.allocTagged('map', heap.ptrSize);
  binding.writeTagged(res, parent ? this.maps[parent].deref() : res, 0);
  return new heap.entities.Map(this, res);
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
  binding.writeTagged(res, this.allocHashMap(size).deref(), heap.ptrSize);

  return new heap.entities.Object(this, res);
};

Heap.prototype.cast = function cast(handle) {
  if (!(handle instanceof heap.entities.Base))
    handle = new heap.entities.Base(this, 'unknown', handle);

  var map = handle.map();

  if (this.checkMap('map', map))
    return new heap.entities.Map(this, handle);
  else if (this.checkMap('hashmap', map))
    return new heap.entities.HashMap(this, handle);
  else if (this.checkMap('object', map))
    return new heap.entities.Object(this, handle);
  else if (this.checkMap('code', map))
    return new heap.entities.Code(this, handle);
  else if (this.checkMap('smi', map))
    return new heap.entities.Smi(this, handle);
  else if (this.checkMap('double', map))
    return new heap.entities.Double(this, handle);
  else if (this.checkMap('string', map))
    return new heap.entities.String(this, handle);
  else if (this.checkMap('hole', map))
    return null;
  else
    throw new Error('Unknown map type');
};

Heap.prototype.registerMap = function registerMap(name, parent) {
  var map = this.allocMap(parent);
  this.maps[name] = map;
  return map;
};

Heap.prototype.checkMap = function checkMap(name, handle) {
  var map = this.maps[name];
  return map.isSame(handle);
};

Heap.prototype.isHole = function isHole(handle) {
  if (handle === null)
    return true;
  return binding.isSame(handle.deref(), this.maps.hole.deref());
};

Heap.prototype.getSpace = function getSpace(handle) {
  if (this.checkMap('code', handle.map()))
    return 'code';
  else
    return 'data';
};

Heap.prototype.gc = function gc(space) {
  this.collector.run(space || 'data');
};

Heap.prototype.visit = function visit(ptr, cb) {
  this.visitor.visit(ptr, cb);
};
