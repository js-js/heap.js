var heap = require('../heap');
var BlockSlice = heap.BlockSlice;
var Space = heap.Space;
var Scope = heap.Scope;
var VirtualScope = heap.VirtualScope;
var MarkCopy = heap.MarkCopy;
var Visitor = heap.Visitor;
var binding = heap.binding;

var assert = require('assert');
var Buffer = require('buffer').Buffer;

function Heap() {
  this.blockSlice = new BlockSlice();

  this.spaces = {
    map: new Space(this, 'map', heap.constants.page.size),
    data: new Space(this, 'data', heap.constants.page.size),
    code: new Space(this, 'code', heap.constants.page.size)
  };

  this.collector = new MarkCopy(this);
  this.visitor = new Visitor(this);
  this.pendingGC = null;

  this.scopes = [];
  this.globals = new Scope(this);
  this.globals.type = 'global';
  this.globals.enter();

  this.maps = {};
  this.registerMap('map', null);
  this.registerMap('hashmap', 'map');
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

Heap.prototype.virtualScope = function virtualScope(cb, ctx) {
  var scope = new VirtualScope(this);
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

Heap.prototype.allocTagged = function allogTagged(space, type, size) {
  var res = this.spaces[space].allocRaw(heap.ptrSize + size);
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
  var res = this.allocTagged('map', 'map', 2 * heap.ptrSize);

  // Type
  binding.writeTagged(res, this.maps.map ? this.maps.map.deref() : res, 0);

  // Parent map
  binding.writeTagged(res,
                      parent ? this.maps[parent].deref() : res,
                      heap.ptrSize);
  return new heap.entities.Map(this, res);
};

Heap.prototype.allocDouble = function allocDouble(val) {
  var res = this.allocTagged('data', 'double', heap.ptrSize);
  res.writeDoubleLE(val, heap.ptrSize, true);
  return new heap.entities.Double(this, res);
};

Heap.prototype.allocString = function allocString(val) {
  var len = Buffer.byteLength(val);
  var res = this.allocTagged('data', 'string', heap.ptrSize + len);

  binding.writeTagged(res, len, heap.ptrSize);
  res.write(val, 2 * heap.ptrSize);

  return new heap.entities.String(this, res);
};

Heap.prototype.allocHashMap = function allocHashMap(size) {
  // NOTE: We allocate twice the `size` to store keys
  var res = this.allocTagged('data', 'hashmap', (1 + 2 * size) * heap.ptrSize);

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

  var res = this.allocTagged('data', 'object', heap.ptrSize);

  this.virtualScope(function() {
    binding.writeTagged(res, this.allocHashMap(size).deref(), heap.ptrSize);
  }, this);

  res = new heap.entities.Object(this, res);
  this.runPendingGC();
  return res;
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

Heap.prototype.getSpace = function getSpace(ptr) {
  // Smi
  if (typeof ptr === 'number')
    return this.spaces.data;

  var map = binding.readTagged(ptr, 0);
  if (binding.isSame(this.maps.code.deref(), map))
    return this.spaces.code;
  else if (binding.isSame(this.maps.map.deref(), map))
    return this.spaces.map;
  else
    return this.spaces.data;
};

Heap.prototype.runPendingGC = function runPendingGC(space) {
  if (this.pendingGC === null)
    return false;

  return this.gc(this.pendingGC);
};

Heap.prototype.gc = function gc(space) {
  // Don't allow GC in virtual scope
  if (this.currentScope().type === 'virtual') {
    this.pendingGC = space;
    return false;
  }

  this.pendingGC = null;

  // No collection will happen there, but we still want to be able to create
  // handles
  this.virtualScope(function() {
    this.collector.run(space ? this.spaces[space] : this.spaces.data);
  }, this);

  return true;
};

Heap.prototype.visit = function visit(ptr, cb) {
  this.visitor.visit(ptr, cb);
};
